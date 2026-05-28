"""业务写操作写入审计表（PostgreSQL）。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.modules.audit.models import AuditLog
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL")
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        pytest.skip("需 PostgreSQL 已执行 alembic（asset.asset）")
    if not pg_schema_has_table(engine, schema="audit", name="audit_log"):
        pytest.skip("需 PostgreSQL 已执行 alembic（audit.audit_log）")


def test_asset_create_emits_audit_row(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"AUD-{uuid.uuid4().hex[:10]}"
    r = client.post(
        "/api/v1/assets",
        headers=h,
        json={"asset_code": code, "asset_name": "审计联调", "main_status": "ACTIVE"},
    )
    assert r.status_code == 200
    aid = r.json()["data"]["id"]

    db = SessionLocal()
    try:
        row = db.execute(
            select(AuditLog).where(AuditLog.action == "ASSET_CREATE", AuditLog.object_id == uuid.UUID(aid))
        ).scalar_one_or_none()
        assert row is not None
        assert row.after_data is not None
        assert row.after_data.get("asset_code") == code
    finally:
        db.close()

    dc = SessionLocal()
    try:
        dc.execute(delete(AuditLog).where(AuditLog.object_id == uuid.UUID(aid)))
        dc.commit()
    except SQLAlchemyError:
        dc.rollback()
    finally:
        dc.close()

    # 清理资产（无 delete API：直接删库或由其它用例兼容；最小化遗留）
    from sqlalchemy import text

    d2 = SessionLocal()
    try:
        d2.execute(text("DELETE FROM asset.asset_qrcode WHERE asset_id = CAST(:aid AS uuid)"), {"aid": aid})
        d2.execute(text("DELETE FROM asset.asset WHERE id = CAST(:aid AS uuid)"), {"aid": aid})
        d2.commit()
    except SQLAlchemyError:
        d2.rollback()
    finally:
        d2.close()
