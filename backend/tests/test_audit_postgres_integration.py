"""审计日志集成测试：PostgreSQL；需 e004_audit + JWT（含 e005 identity）。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditLogCreate
from app.modules.audit.service import append_log
from app.modules.auth.service import hash_password
from app.modules.identity.models import AppUser, UserRole
from pg_jwt_helpers import pg_schema_has_table


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + Alembic（含 audit、e005 identity）")
    if not pg_schema_has_table(engine, schema="audit", name="audit_log"):
        pytest.skip("需 PostgreSQL 已迁移 audit.audit_log")
    if not pg_schema_has_table(engine, schema="identity", name="app_user"):
        pytest.skip("需 PostgreSQL 已迁移 identity.app_user")


def test_audit_via_service_and_http(client: TestClient, require_postgres_db) -> None:
    suffix = uuid.uuid4().hex[:10]
    uname = f"pytest_aud_{suffix}"
    passwd = "t3st-Secret-!"
    viewer = f"viewer_aud_{suffix}"
    qid = uuid.uuid4()
    uid = uuid.uuid4()

    db_seed = SessionLocal()
    try:
        db_seed.add(
            AppUser(
                id=uid,
                username=uname,
                password_hash=hash_password(passwd),
                display_name="pytest auditor",
                is_active=True,
            )
        )
        db_seed.add(UserRole(user_id=uid, role_code="AUDIT_ADMIN"))
        db_seed.commit()
    finally:
        db_seed.close()

    dbw = SessionLocal()
    try:
        append_log(
            dbw,
            AuditLogCreate(
                action="LOGIN_LEGACY",
                username=viewer,
                role_code="DEPT_USER",
                object_type="session",
                after_data={"scope": "read"},
            ),
        )
        append_log(
            dbw,
            AuditLogCreate(action="DEVICE_VIEW", username=viewer, object_type="asset", object_id=qid),
        )
    finally:
        dbw.close()

    lg = client.post("/api/v1/auth/login", json={"username": uname, "password": passwd})
    assert lg.status_code == 200, lg.text
    token = lg.json()["data"]["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    try:
        res = client.get("/api/v1/audit/logs", params={"username": "viewer_aud"}, headers=auth)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["total"] >= 1

        by_action = client.get("/api/v1/audit/logs", params={"action": "DEVICE"}, headers=auth)
        assert by_action.status_code == 200
        js = by_action.json()["data"]
        assert any(x["object_id"] == str(qid) for x in js["items"])

        legacy = client.get("/api/v1/system/audit-events", headers=auth)
        assert legacy.status_code == 200
        assert legacy.json()["data"]["recommended_path"] == "/api/v1/audit/logs"
    finally:
        dbc = SessionLocal()
        try:
            dbc.execute(delete(AuditLog).where(AuditLog.username.in_([viewer, uname])))
            dbc.execute(delete(UserRole).where(UserRole.user_id == uid))
            dbc.execute(delete(AppUser).where(AppUser.id == uid))
            dbc.commit()
        except SQLAlchemyError:
            dbc.rollback()
        finally:
            dbc.close()
