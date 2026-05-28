"""数字运营中心公开大屏访问契约。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from app.modules.operation_center.models import ScreenAccessKey, ScreenAccessLog, ScreenTerminal
from pg_jwt_helpers import skip_without_identity_jwt


def _operation_center_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table("screen_access_key", schema="operation_center"))
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_operation_center_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL（含 operation_center 迁移 e019）")
    if not _operation_center_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（operation_center.screen_access_key 等）")


def test_operation_center_access_key_public_screen_and_logs(
    client: TestClient,
    require_operation_center_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    headers = skip_without_identity_jwt(pg_admin_headers)
    key_value = f"pytest-screen-{uuid.uuid4().hex}"
    key_id: str | None = None

    try:
        created = client.post(
            "/api/v1/operation-center/access-keys",
            headers=headers,
            json={
                "key_name": "pytest 大屏密钥",
                "screen_code": "equipment-overview",
                "access_key": key_value,
                "is_enabled": True,
                "desensitized": True,
                "refresh_interval_seconds": 30,
                "carousel_interval_seconds": 10,
            },
        )
        assert created.status_code == 200, created.text
        data = created.json()["data"]
        key_id = data["id"]
        assert data["access_key"] == key_value

        ok = client.get(f"/screen-api/equipment-overview?accessKey={key_value}", headers={"User-Agent": "pytest-screen"})
        assert ok.status_code == 200, ok.text
        payload = ok.json()["data"]
        assert payload["screen"]["code"] == "equipment-overview"
        assert payload["desensitized"] is True
        assert payload["refresh_interval_seconds"] == 30

        denied = client.get(f"/screen-api/equipment-status?accessKey={key_value}", headers={"User-Agent": "pytest-screen"})
        assert denied.status_code == 403

        logs = client.get("/api/v1/operation-center/access-logs", headers=headers, params={"screen_code": "equipment-overview"})
        assert logs.status_code == 200
        assert any(x["access_key"] == key_value and x["success"] for x in logs.json()["data"]["items"])
    finally:
        if key_id:
            db = SessionLocal()
            try:
                kid = uuid.UUID(key_id)
                db.execute(delete(ScreenAccessLog).where(ScreenAccessLog.access_key == key_value))
                db.execute(delete(ScreenTerminal).where(ScreenTerminal.access_key_id == kid))
                db.execute(delete(ScreenAccessKey).where(ScreenAccessKey.id == kid))
                db.commit()
            except SQLAlchemyError:
                db.rollback()
            finally:
                db.close()


def test_operation_center_public_screen_websocket(
    client: TestClient,
    require_operation_center_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    headers = skip_without_identity_jwt(pg_admin_headers)
    key_value = f"pytest-screen-ws-{uuid.uuid4().hex}"
    key_id: str | None = None

    try:
        created = client.post(
            "/api/v1/operation-center/access-keys",
            headers=headers,
            json={
                "key_name": "pytest 大屏 WS 密钥",
                "screen_code": "equipment-overview",
                "access_key": key_value,
                "is_enabled": True,
                "desensitized": True,
                "refresh_interval_seconds": 10,
                "carousel_interval_seconds": 10,
            },
        )
        assert created.status_code == 200, created.text
        key_id = created.json()["data"]["id"]

        with client.websocket_connect(f"/screen-ws/equipment-overview?accessKey={key_value}") as ws:
            msg = ws.receive_json()
        assert msg["code"] == 0
        payload = msg["data"]
        assert payload["screen"]["code"] == "equipment-overview"
        assert payload["refresh_interval_seconds"] == 10
        assert "kpis" in payload
    finally:
        if key_id:
            db = SessionLocal()
            try:
                kid = uuid.UUID(key_id)
                db.execute(delete(ScreenAccessLog).where(ScreenAccessLog.access_key == key_value))
                db.execute(delete(ScreenTerminal).where(ScreenTerminal.access_key_id == kid))
                db.execute(delete(ScreenAccessKey).where(ScreenAccessKey.id == kid))
                db.commit()
            except SQLAlchemyError:
                db.rollback()
            finally:
                db.close()
