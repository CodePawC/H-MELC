"""供应商门户集成测试 · PostgreSQL e009."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from app.modules.auth.service import hash_password
from app.modules.supplier_portal.models import SupplierOrganization, SupplierPortalAccount
from pg_jwt_helpers import skip_without_identity_jwt


def _portal_supplier_tables_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table("organization", schema="supplier"))
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + e009_supplier_portal")
    if not _portal_supplier_tables_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（supplier.organization 等）")


@pytest.fixture(autouse=True)
def _purge_pytest_supplier_orgs() -> None:
    yield
    if engine.dialect.name != "postgresql":
        return
    if not _portal_supplier_tables_ready():
        return
    db = SessionLocal()
    try:
        db.execute(delete(SupplierOrganization).where(SupplierOrganization.legal_name.like("pytest_supplier_%")))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_supplier_login_dashboard_qualifications_flow(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    uname = f"pytest_sup_u_{suf}"
    pwd = "SupPw-123!!zz"
    org_id = uuid.uuid4()
    acc_id = uuid.uuid4()
    lg_name = f"pytest_supplier_{suf}"

    db = SessionLocal()
    try:
        db.add(SupplierOrganization(id=org_id, legal_name=lg_name, short_name="PYT"))
        db.add(
            SupplierPortalAccount(
                id=acc_id,
                organization_id=org_id,
                username=uname,
                password_hash=hash_password(pwd),
                display_name="门户测试账号",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    lo = client.post("/api/v1/supplier-portal/auth/login", json={"username": uname, "password": pwd})
    assert lo.status_code == 200, lo.text
    j = lo.json()
    assert j["code"] == 0
    assert j["data"]["user"]["roles"] == ["SUPPLIER"]

    hdr = {"Authorization": f'Bearer {j["data"]["access_token"]}'}

    bd = client.get("/api/v1/supplier-portal/dashboard", headers=hdr)
    assert bd.status_code == 200
    d = bd.json()["data"]
    assert set(d.keys()) >= {
        "unpaid_amount",
        "paid_amount",
        "pending_invoice_count",
        "missing_material_count",
        "active_projects_count",
        "payment_progress_pct",
    }
    assert d["missing_material_count"] == 0

    bad_hospital = client.get("/api/v1/supplier-portal/dashboard", headers=h)
    assert bad_hospital.status_code == 403

    qc = client.post("/api/v1/supplier-portal/qualifications", headers=hdr, data={"title": "营业执照副本"})
    assert qc.status_code == 200, qc.text
    qid = qc.json()["data"]["id"]

    bd2 = client.get("/api/v1/supplier-portal/dashboard", headers=hdr)
    assert bd2.status_code == 200
    assert bd2.json()["data"]["missing_material_count"] >= 1

    ql = client.get("/api/v1/supplier-portal/qualifications", headers=hdr)
    assert ql.status_code == 200
    assert any(x["id"] == qid for x in ql.json()["data"]["items"])

    gq = client.get(f"/api/v1/supplier-portal/qualifications/{qid}", headers=hdr)
    assert gq.status_code == 200, gq.text
    assert gq.json()["data"]["id"] == qid
    assert (
        client.get(
            f"/api/v1/supplier-portal/qualifications/{uuid.uuid4()}",
            headers=hdr,
        ).status_code
        == 404
    )


def test_hospital_qualification_review_flow(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    ah = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    org_id = uuid.uuid4()
    acc_id = uuid.uuid4()
    uname = f"pytest_qual_hqv_u_{suf}"
    pwd = "SupPw-123!!qq"
    lg_name = f"pytest_supplier_hqv_{suf}"

    db = SessionLocal()
    try:
        db.add(SupplierOrganization(id=org_id, legal_name=lg_name, short_name="QRV"))
        db.add(
            SupplierPortalAccount(
                id=acc_id,
                organization_id=org_id,
                username=uname,
                password_hash=hash_password(pwd),
                display_name="资质审核流",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    lo = client.post("/api/v1/supplier-portal/auth/login", json={"username": uname, "password": pwd})
    assert lo.status_code == 200, lo.text
    hdr = {"Authorization": f'Bearer {lo.json()["data"]["access_token"]}'}

    qc = client.post("/api/v1/supplier-portal/qualifications", headers=hdr, data={"title": "医疗器械经营许可证"})
    assert qc.status_code == 200, qc.text
    q_raw = qc.json()["data"]
    qid = q_raw["id"]
    assert q_raw["review_status"] == "PENDING"

    hsl = client.get("/api/v1/suppliers/qualifications", headers=ah, params={"organization_id": str(org_id)})
    assert hsl.status_code == 200, hsl.text
    assert hsl.json()["data"]["total"] >= 1
    assert any(str(x["id"]) == str(qid) for x in hsl.json()["data"]["items"])

    g1 = client.get(f"/api/v1/suppliers/qualifications/{qid}", headers=ah)
    assert g1.status_code == 200, g1.text
    qd = g1.json()["data"]
    assert str(qd["id"]) == str(qid)
    assert qd["organization_legal_name"] == lg_name

    rv1 = client.post(
        f"/api/v1/suppliers/qualifications/{qid}/review",
        headers=ah,
        json={"confirm_status": "REJECTED", "comment": "不清晰"},
    )
    assert rv1.status_code == 200, rv1.text
    d1 = rv1.json()["data"]
    assert d1["review_status"] == "REJECTED"
    assert d1["review_comment"] == "不清晰"

    pl = client.get("/api/v1/supplier-portal/qualifications", headers=hdr)
    assert pl.status_code == 200
    row = next(x for x in pl.json()["data"]["items"] if str(x["id"]) == str(qid))
    assert row["review_status"] == "REJECTED"

    rv2 = client.post(
        f"/api/v1/suppliers/qualifications/{qid}/review",
        headers=ah,
        json={"confirm_status": "ACCEPTED", "comment": "复审通过"},
    )
    assert rv2.status_code == 200, rv2.text
    assert rv2.json()["data"]["review_status"] == "ACCEPTED"

    rv3 = client.post(
        f"/api/v1/suppliers/qualifications/{qid}/review",
        headers=ah,
        json={"confirm_status": "REJECTED"},
    )
    assert rv3.status_code == 409

    filt = client.get(
        "/api/v1/suppliers/qualifications",
        headers=ah,
        params={"organization_id": str(org_id), "review_status": "PENDING"},
    )
    assert filt.status_code == 200
    assert not any(str(x["id"]) == str(qid) for x in filt.json()["data"]["items"])
