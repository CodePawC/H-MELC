"""Pytest fixtures."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError
from starlette.testclient import TestClient

from app.main import app
from pg_jwt_helpers import pg_schema_has_table


@pytest.fixture
def client() -> TestClient:
    """使用上下文管理触发 FastAPI lifespan（启动时 ensure_minio_bucket 等）。"""
    with TestClient(app) as tc:
        yield tc


@pytest.fixture
def pg_admin_headers(client: TestClient) -> dict[str, str] | None:
    """PostgreSQL：预置全院功能测试账号（多角色 JWT）；SQLite yield None。

    已连 PostgreSQL 但未创建 `identity.app_user` 时 yield None，避免 INSERT/commit 报错；
    用例应在进入「须 JWT」分支后调用 ``skip_without_identity_jwt(pg_admin_headers)``。
    """
    from app.db.session import SessionLocal, engine
    from app.modules.audit.models import AuditLog
    from app.modules.auth.service import hash_password
    from app.modules.identity.models import AppUser, UserRole

    if engine.dialect.name != "postgresql":
        yield None
        return

    try:
        insp = sa_inspect(engine)
        if not (
            insp.has_table("app_user", schema="identity")
            and insp.has_table("user_role", schema="identity")
        ):
            yield None
            return
    except SQLAlchemyError:
        yield None
        return

    suf = uuid.uuid4().hex[:12]
    uname = f"h_{suf}_api"
    password = f"Api-Pw-{suf[:6]}!!"
    uid = uuid.uuid4()
    codes = ["SYS_ADMIN", "DEVICE_ADMIN", "ENGINEER", "DEPT_USER", "AUDIT_ADMIN"]
    hdr: dict[str, str] | None = None

    try:
        db = SessionLocal()
        try:
            db.add(
                AppUser(
                    id=uid,
                    username=uname,
                    password_hash=hash_password(password),
                    display_name="pytest rbac",
                    is_active=True,
                )
            )
            for c in codes:
                db.add(UserRole(user_id=uid, role_code=c))
            db.commit()
        finally:
            db.close()

        lg = client.post("/api/v1/auth/login", json={"username": uname, "password": password})
        assert lg.status_code == 200, lg.text
        hdr = {"Authorization": f"Bearer {lg.json()['data']['access_token']}"}
        yield hdr
    finally:
        dc = SessionLocal()
        try:
            if pg_schema_has_table(engine, schema="audit", name="audit_log"):
                dc.execute(delete(AuditLog).where(AuditLog.username == uname))
            dc.execute(delete(UserRole).where(UserRole.user_id == uid))
            dc.execute(delete(AppUser).where(AppUser.id == uid))
            dc.commit()
        except SQLAlchemyError:
            dc.rollback()
        finally:
            dc.close()
