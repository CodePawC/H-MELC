"""认证与 RBAC Phase 0 集成测试（PostgreSQL + e005）。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.modules.auth.service import hash_password
from app.modules.identity.models import AppUser, UserRole
from pg_jwt_helpers import pg_schema_has_table


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + Alembic e005_identity_auth")
    if not pg_schema_has_table(engine, schema="identity", name="app_user"):
        pytest.skip("需 PostgreSQL 已迁移 identity.app_user")
    if not pg_schema_has_table(engine, schema="identity", name="user_role"):
        pytest.skip("需 PostgreSQL 已迁移 identity.user_role")


def _seed_user(username: str, password: str, roles: list[str]) -> uuid.UUID:
    uid = uuid.uuid4()
    db = SessionLocal()
    try:
        db.add(
            AppUser(
                id=uid,
                username=username,
                password_hash=hash_password(password),
                display_name=username,
                is_active=True,
            )
        )
        for r in roles:
            db.add(UserRole(user_id=uid, role_code=r))
        db.commit()
        return uid
    finally:
        db.close()


def _purge_user(uid: uuid.UUID, username: str) -> None:
    from app.db.session import engine
    from app.modules.audit.models import AuditLog

    db = SessionLocal()
    try:
        if pg_schema_has_table(engine, schema="audit", name="audit_log"):
            db.execute(delete(AuditLog).where(AuditLog.username == username))
        db.execute(delete(UserRole).where(UserRole.user_id == uid))
        db.execute(delete(AppUser).where(AppUser.id == uid))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_login_and_me_roundtrip(client: TestClient, require_postgres_db) -> None:
    suf = uuid.uuid4().hex[:10]
    u, pw = f"auth_ok_{suf}", "Pw!-correct-123"
    uid = _seed_user(u, pw, ["SYS_ADMIN"])
    try:
        res = client.post("/api/v1/auth/login", json={"username": u, "password": pw})
        assert res.status_code == 200
        tok = res.json()["data"]["access_token"]

        bad = client.get("/api/v1/auth/me")
        assert bad.status_code == 401

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200
        body = me.json()["data"]
        assert body["username"] == u
        assert "SYS_ADMIN" in body["roles"]
    finally:
        _purge_user(uid, u)


def test_login_wrong_password(client: TestClient, require_postgres_db) -> None:
    suf = uuid.uuid4().hex[:10]
    u, pw = f"auth_bad_{suf}", "right-pass"
    uid = _seed_user(u, pw, ["ENGINEER"])
    try:
        r = client.post("/api/v1/auth/login", json={"username": u, "password": "wrong-pass"})
        assert r.status_code == 401
    finally:
        _purge_user(uid, u)


def test_dept_user_cannot_audit_logs(client: TestClient, require_postgres_db) -> None:
    from app.db.session import engine

    if not pg_schema_has_table(engine, schema="audit", name="audit_log"):
        pytest.skip("需 audit.audit_log，否则 /audit/logs 可能 503 而非本用例期望的 403")
    suf = uuid.uuid4().hex[:10]
    u, pw = f"auth_dept_{suf}", "dept-pass-9"
    uid = _seed_user(u, pw, ["DEPT_USER"])
    try:
        lg = client.post("/api/v1/auth/login", json={"username": u, "password": pw})
        tok = lg.json()["data"]["access_token"]
        aud = client.get("/api/v1/audit/logs", headers={"Authorization": f"Bearer {tok}"})
        assert aud.status_code == 403
    finally:
        _purge_user(uid, u)
