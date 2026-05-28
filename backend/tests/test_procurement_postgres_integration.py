"""院内竞价发布、门户报价、审核落库与中选 · PostgreSQL（e010/e011/e012/e013）."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from pg_jwt_helpers import skip_without_identity_jwt
from app.modules.auth.service import hash_password
from app.modules.supplier_portal.models import SupplierOrganization, SupplierPortalAccount
from app.modules.supplier_projects.models import ProcurementProject


def _procurement_tables_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table("procurement_project", schema="supplier"))
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL（含 procurement 迁移 e010、e011、e012、e013）")
    if not _procurement_tables_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（supplier.procurement_project 等）")


@pytest.fixture(autouse=True)
def _purge_pytest_procurement() -> None:
    yield
    if engine.dialect.name != "postgresql":
        return
    if not _procurement_tables_ready():
        return
    db = SessionLocal()
    try:
        db.execute(delete(ProcurementProject).where(ProcurementProject.title.like("pytest_proc_%")))  # type: ignore[arg-type]
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_publish_visible_on_supplier_portal(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h_admin = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]

    oid = uuid.uuid4()
    acc_id = uuid.uuid4()
    org_id = uuid.uuid4()
    uname = f"pytest_sb_{suf}"
    pwd = "SbPw-123!!kk"

    db = SessionLocal()
    try:
        db.add(SupplierOrganization(id=org_id, legal_name=f"pytest_org_{suf}", short_name="P"))
        db.add(
            SupplierPortalAccount(
                id=acc_id,
                organization_id=org_id,
                username=uname,
                password_hash=hash_password(pwd),
                display_name="sb",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    try:
        title = f"pytest_proc_{uuid.uuid4().hex[:12]}"
        cr = client.post(
            "/api/v1/supplier-projects",
            headers=h_admin,
            json={"title": title, "summary": "契约集成"},
        )
        assert cr.status_code == 200, cr.text
        pid = cr.json()["data"]["id"]

        lo = client.post("/api/v1/supplier-portal/auth/login", json={"username": uname, "password": pwd})
        assert lo.status_code == 200, lo.text
        tok = lo.json()["data"]["access_token"]
        lst = client.get("/api/v1/supplier-portal/projects", headers={"Authorization": f"Bearer {tok}"})
        assert lst.status_code == 200
        items = lst.json()["data"]["items"]
        assert any(str(x["id"]) == str(pid) and x["title"] == title for x in items)

        h_sup = {"Authorization": f"Bearer {tok}"}
        det = client.get(f"/api/v1/supplier-portal/projects/{pid}", headers=h_sup)
        assert det.status_code == 200
        assert det.json()["data"]["title"] == title

        bd = client.post(
            f"/api/v1/supplier-portal/projects/{pid}/bids",
            headers=h_sup,
            json={"quoted_amount": "12000.50", "remark": "含税"},
        )
        assert bd.status_code == 200, bd.text
        assert bd.json()["data"]["quoted_amount"] == 12000.5

        dash = client.get("/api/v1/supplier-portal/dashboard", headers=h_sup)
        assert dash.status_code == 200
        assert dash.json()["data"]["active_projects_count"] == 1

        bid_id = bd.json()["data"]["id"]

        bl = client.get(f"/api/v1/supplier-projects/{pid}/bids", headers=h_admin)
        assert bl.status_code == 200
        bitems_pre = bl.json()["data"]["items"]
        assert len(bitems_pre) == 1
        assert bitems_pre[0]["selected"] is False
        assert bl.json()["data"]["total"] == 1

        dup = client.post(
            f"/api/v1/supplier-portal/projects/{pid}/bids",
            headers=h_sup,
            json={"quoted_amount": "13000"},
        )
        assert dup.status_code == 409

        sel = client.get(f"/api/v1/supplier-portal/projects/{pid}/bids", headers=h_sup)
        assert sel.status_code == 200, sel.text
        assert sel.json()["data"]["total"] == 1
        assert sel.json()["data"]["items"][0]["quoted_amount"] == 12000.5

        rv_close = client.post(
            f"/api/v1/supplier-projects/{pid}/review",
            headers=h_admin,
            json={"remark": "终审收官", "decision": "CLOSED", "winning_bid_id": str(bid_id)},
        )
        assert rv_close.status_code == 200, rv_close.text
        rvj = rv_close.json()["data"]
        assert rvj["status"] == "CLOSED"
        assert str(rvj["winning_bid_id"]) == str(bid_id)

        bl_win = client.get(f"/api/v1/supplier-projects/{pid}/bids", headers=h_admin)
        assert bl_win.json()["data"]["items"][0]["selected"] is True

        sel_closed = client.get(f"/api/v1/supplier-portal/projects/{pid}/bids", headers=h_sup)
        assert sel_closed.json()["data"]["items"][0]["selected"] is True

        det_gone = client.get(f"/api/v1/supplier-portal/projects/{pid}", headers=h_sup)
        assert det_gone.status_code == 404

        rejected_bid = client.post(
            f"/api/v1/supplier-portal/projects/{pid}/bids",
            headers=h_sup,
            json={"quoted_amount": "999"},
        )
        assert rejected_bid.status_code == 409
    finally:
        dc = SessionLocal()
        try:
            dc.execute(delete(SupplierOrganization).where(SupplierOrganization.id == org_id))
            dc.commit()
        finally:
            dc.close()


def test_procurement_review_persists(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h_ad = skip_without_identity_jwt(pg_admin_headers)
    title = f"pytest_proc_{uuid.uuid4().hex[:12]}"
    cr = client.post(
        "/api/v1/supplier-projects",
        headers=h_ad,
        json={"title": title},
    )
    assert cr.status_code == 200
    pid = cr.json()["data"]["id"]

    rv = client.post(
        f"/api/v1/supplier-projects/{pid}/review",
        headers=h_ad,
        json={"remark": "废止", "decision": "CANCELLED"},
    )
    assert rv.status_code == 200
    body = rv.json()["data"]
    assert body["status"] == "CANCELLED"
    assert body.get("review_remark") == "废止"
    assert body.get("reviewer_user_id") is not None
    assert body.get("winning_bid_id") is None

    dup = client.post(
        f"/api/v1/supplier-projects/{pid}/review",
        headers=h_ad,
        json={"decision": "CLOSED"},
    )
    assert dup.status_code == 409

    t2 = f"pytest_proc_{uuid.uuid4().hex[:12]}"
    cr2 = client.post(
        "/api/v1/supplier-projects",
        headers=h_ad,
        json={"title": t2},
    )
    assert cr2.status_code == 200
    pid2 = cr2.json()["data"]["id"]
    bad_combo = client.post(
        f"/api/v1/supplier-projects/{pid2}/review",
        headers=h_ad,
        json={"remark": "x", "decision": "CANCELLED", "winning_bid_id": str(uuid.uuid4())},
    )
    assert bad_combo.status_code == 400

    t3 = f"pytest_proc_{uuid.uuid4().hex[:12]}"
    cr3 = client.post(
        "/api/v1/supplier-projects",
        headers=h_ad,
        json={"title": t3},
    )
    assert cr3.status_code == 200
    pid3 = cr3.json()["data"]["id"]
    bad_win = client.post(
        f"/api/v1/supplier-projects/{pid3}/review",
        headers=h_ad,
        json={"decision": "CLOSED", "winning_bid_id": str(uuid.uuid4())},
    )
    assert bad_win.status_code == 400
