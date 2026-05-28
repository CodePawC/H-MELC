"""计量与合规模块 · PostgreSQL（e018_metrology_core）。"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from app.modules.asset.models import Asset
from app.modules.metrology.models import CalibrationPlan, MetrologyCertificate, MetrologyDevice
from pg_jwt_helpers import skip_without_identity_jwt


def _metrology_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table("metrology_device", schema="metrology"))
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL（含 metrology 迁移 e018）")
    if not _metrology_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（metrology.metrology_device 等）")


@pytest.fixture
def asset_id(require_postgres_db) -> uuid.UUID:
    aid = uuid.uuid4()
    db = SessionLocal()
    try:
        db.add(
            Asset(
                id=aid,
                asset_code=f"PY-MT-{aid.hex[:8]}",
                asset_name="pytest 计量设备",
                main_status="ACTIVE",
            )
        )
        db.commit()
    finally:
        db.close()
    yield aid
    dc = SessionLocal()
    try:
        dc.execute(delete(MetrologyCertificate).where(MetrologyCertificate.asset_id == aid))
        dc.execute(delete(CalibrationPlan).where(CalibrationPlan.asset_id == aid))
        dc.execute(delete(MetrologyDevice).where(MetrologyDevice.asset_id == aid))
        dc.execute(delete(Asset).where(Asset.id == aid))
        dc.commit()
    except SQLAlchemyError:
        dc.rollback()
    finally:
        dc.close()


def test_metrology_device_plan_certificate_and_alerts(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
    asset_id: uuid.UUID,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    due = date.today() + timedelta(days=15)

    dev = client.post(
        "/api/v1/metrology/devices",
        headers=h,
        json={
            "asset_id": str(asset_id),
            "regulatory_class": "STRONG_CHECK",
            "calibration_status": "SOON",
            "meter_type": "强检",
            "cycle_months": 12,
            "last_calibrated_at": str(date.today() - timedelta(days=350)),
            "next_due_date": str(due),
            "issuing_body": "pytest 计量院",
        },
    )
    assert dev.status_code == 200, dev.text
    assert dev.json()["data"]["asset_id"] == str(asset_id)

    lst = client.get("/api/v1/metrology/devices", headers=h, params={"regulatory_class": "STRONG_CHECK"})
    assert lst.status_code == 200
    assert any(x["asset_id"] == str(asset_id) for x in lst.json()["data"]["items"])

    plan = client.post(
        "/api/v1/metrology/calibration-plans",
        headers=h,
        json={
            "asset_id": str(asset_id),
            "title": "pytest 年度检定",
            "planned_date": str(due),
            "assigned_org": "pytest 计量院",
        },
    )
    assert plan.status_code == 200, plan.text
    pid = plan.json()["data"]["id"]

    patched = client.patch(
        f"/api/v1/metrology/calibration-plans/{pid}",
        headers=h,
        json={
            "asset_id": str(asset_id),
            "title": "pytest 年度检定更新",
            "planned_date": str(due),
            "plan_status": "SENT",
            "assigned_org": "pytest 计量院",
        },
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["plan_status"] == "SENT"

    cert = client.post(
        "/api/v1/metrology/certificates",
        headers=h,
        json={
            "asset_id": str(asset_id),
            "certificate_no": f"PY-CERT-{uuid.uuid4().hex[:10]}",
            "issued_at": str(date.today()),
            "valid_to": str(due),
            "issuing_body": "pytest 计量院",
            "conclusion": "PASS",
        },
    )
    assert cert.status_code == 200, cert.text
    cid = cert.json()["data"]["id"]

    bundle = client.get(f"/api/v1/metrology/devices/{asset_id}", headers=h)
    assert bundle.status_code == 200
    assert bundle.json()["data"]["current_certificate"]["id"] == cid
    assert len(bundle.json()["data"]["plans"]) == 1

    alerts = client.get("/api/v1/metrology/alerts/expiry", headers=h, params={"within_days": 30})
    assert alerts.status_code == 200
    kinds = {x["alert_type"] for x in alerts.json()["data"]["items"] if x["asset_id"] == str(asset_id)}
    assert {"CALIBRATION_DUE", "CERTIFICATE_EXPIRY"}.issubset(kinds)

    portfolio = client.get("/api/v1/metrology/portfolios/STRONG_CHECK", headers=h)
    assert portfolio.status_code == 200
    assert any(x["asset_id"] == str(asset_id) for x in portfolio.json()["data"]["items"])
