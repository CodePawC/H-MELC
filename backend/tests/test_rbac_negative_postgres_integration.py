"""RBAC 负例：单角色账号在禁止路径上应返回 403。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.modules.audit.models import AuditLog
from app.modules.auth.service import hash_password
from app.modules.identity.models import AppUser, UserRole
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL")
    if not pg_schema_has_table(engine, schema="identity", name="app_user"):
        pytest.skip("需 PostgreSQL 已迁移 identity schema")
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        pytest.skip("需 PostgreSQL 已迁移 asset.asset")
    if not pg_schema_has_table(engine, schema="repair", name="repair_order"):
        pytest.skip("需 PostgreSQL 已迁移 repair.repair_order")


def _seed(username: str, password: str, roles: list[str]) -> uuid.UUID:
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


def _purge(uid: uuid.UUID, username: str) -> None:
    from app.db.session import engine

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


def _login(client: TestClient, u: str, p: str) -> dict[str, str]:
    r = client.post("/api/v1/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


def test_engineer_cannot_force_assign(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    hdr = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:8]
    eu, ep = f"eng_na_{suf}", f"Epw-{suf}!"
    eng_id = _seed(eu, ep, ["ENGINEER"])
    try:
        aid = (
            client.post(
                "/api/v1/assets",
                headers=hdr,
                json={
                    "asset_code": f"RBAC-A-{suf}",
                    "asset_name": "RBAC 设备",
                    "main_status": "ACTIVE",
                },
            )
            .json()["data"]["id"]
        )
        he = _login(client, eu, ep)
        oid = (
            client.post(
                "/api/v1/repairs",
                headers=he,
                json={"asset_id": aid, "fault_description": "测派单"},
            )
            .json()["data"]["id"]
        )
        r = client.post(
            f"/api/v1/repairs/{oid}/assign",
            headers=he,
            json={"engineer_id": str(uuid.uuid4()), "reason": "应由设备科派单"},
        )
        assert r.status_code == 403
    finally:
        _purge(eng_id, eu)


def test_dept_user_cannot_claim(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    hdr = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:8]
    du, dp = f"dept_na_{suf}", f"Dpw-{suf}!"
    dept_uid = _seed(du, dp, ["DEPT_USER"])
    try:
        aid = (
            client.post(
                "/api/v1/assets",
                headers=hdr,
                json={"asset_code": f"RBAC-B-{suf}", "asset_name": "床", "main_status": "ACTIVE"},
            )
            .json()["data"]["id"]
        )
        oid = (
            client.post(
                "/api/v1/repairs",
                headers=hdr,
                json={"asset_id": aid, "fault_description": "待接单"},
            )
            .json()["data"]["id"]
        )
        hd = _login(client, du, dp)
        r = client.post(f"/api/v1/repairs/{oid}/claim", headers=hd, json={"engineer_id": str(uuid.uuid4())})
        assert r.status_code == 403
    finally:
        _purge(dept_uid, du)


def test_engineer_cannot_department_confirm(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    hdr = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:8]
    eu, ep = f"eng_nc_{suf}", f"Epw2-{suf}!"
    eng_id = _seed(eu, ep, ["ENGINEER"])
    try:
        aid = (
            client.post(
                "/api/v1/assets",
                headers=hdr,
                json={"asset_code": f"RBAC-C-{suf}", "asset_name": "泵", "main_status": "ACTIVE"},
            )
            .json()["data"]["id"]
        )
        he = _login(client, eu, ep)
        oid = (
            client.post(
                "/api/v1/repairs",
                headers=he,
                json={"asset_id": aid, "fault_description": "异响"},
            )
            .json()["data"]["id"]
        )
        eid = str(uuid.uuid4())
        assert (
            client.post(f"/api/v1/repairs/{oid}/claim", headers=he, json={"engineer_id": eid}).status_code == 200
        )
        assert client.post(f"/api/v1/repairs/{oid}/complete", headers=he, json={"conclusion": "已修"}).status_code == 200
        r = client.post(
            f"/api/v1/repairs/{oid}/confirm",
            headers=he,
            json={"confirm_status": "ACCEPTED", "comment": "工程师代签应拒绝"},
        )
        assert r.status_code == 403
    finally:
        _purge(eng_id, eu)
