"""财务发票持久化 · PostgreSQL e014 + MinIO."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect, select
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from pg_jwt_helpers import skip_without_identity_jwt
from app.modules.auth.service import hash_password
from app.modules.finance.models import Invoice, Payable, Payment, PaymentAllocation
from app.modules.supplier_portal.models import SupplierOrganization, SupplierPortalAccount


def _finance_integration_tables_ready() -> bool:
    """未迁库时跳过集成用例，避免 insert / teardown 对缺表抛错。"""
    if engine.dialect.name != "postgresql":
        return False
    try:
        insp = sa_inspect(engine)
        return insp.has_table("organization", schema="supplier") and insp.has_table(
            "invoice", schema="finance"
        )
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_finance() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL（含 e014、e015 finance）与 MinIO")
    if not _finance_integration_tables_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic upgrade（含 supplier、e014、e015）")


@pytest.fixture(autouse=True)
def _purge_pytest_finance_orgs() -> None:
    yield
    if engine.dialect.name != "postgresql":
        return
    if not _finance_integration_tables_ready():
        return
    db = SessionLocal()
    try:
        sub = select(SupplierOrganization.id).where(SupplierOrganization.legal_name.like("pytest_fin_org_%"))
        ids = list(db.scalars(sub).all())
        if ids:
            pid_sub = select(Payment.id).where(Payment.organization_id.in_(ids))
            pids = list(db.scalars(pid_sub).all())
            if pids:
                db.execute(delete(PaymentAllocation).where(PaymentAllocation.payment_id.in_(pids)))
            db.execute(delete(Payment).where(Payment.organization_id.in_(ids)))
            db.execute(delete(Payable).where(Payable.organization_id.in_(ids)))
            db.execute(delete(Invoice).where(Invoice.organization_id.in_(ids)))
            db.execute(delete(SupplierPortalAccount).where(SupplierPortalAccount.organization_id.in_(ids)))
            db.execute(delete(SupplierOrganization).where(SupplierOrganization.id.in_(ids)))
            db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_invoice_upload_list_detail_review_and_portal_list(
    client: TestClient,
    require_postgres_finance,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    org_id = uuid.uuid4()
    acc_id = uuid.uuid4()
    uname = f"pytest_fin_u_{suf}"
    pwd = "FinPw-123!!kk"

    db = SessionLocal()
    try:
        db.add(SupplierOrganization(id=org_id, legal_name=f"pytest_fin_org_{suf}", short_name="F"))
        db.add(
            SupplierPortalAccount(
                id=acc_id,
                organization_id=org_id,
                username=uname,
                password_hash=hash_password(pwd),
                display_name="财务集成",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    files = {"file": ("stub.pdf", b"%PDF-1.5\n%\xe2\xe3\xcf\xd3 pytest\n", "application/pdf")}
    data = {"organization_id": str(org_id)}
    up = client.post("/api/v1/finance/invoices/upload", headers=h, files=files, data=data)
    assert up.status_code == 200, up.text
    inv = up.json()["data"]
    iid = inv["id"]
    assert inv.get("ocr_review_status") == "PENDING"
    assert inv.get("ai_task_id") and inv.get("ai_result_id")

    lst = client.get("/api/v1/finance/invoices", headers=h)
    assert lst.status_code == 200
    assert lst.json()["data"]["total"] >= 1

    gd = client.get(f"/api/v1/finance/invoices/{iid}", headers=h)
    assert gd.status_code == 200
    assert "ocr_result" in gd.json()["data"]

    rv = client.post(
        f"/api/v1/finance/invoices/{iid}/review",
        headers=h,
        json={"confirm_status": "ACCEPTED", "comment": "集成通过"},
    )
    assert rv.status_code == 200, rv.text
    assert rv.json()["data"]["review_status"] == "ACCEPTED"

    chk = client.get(f"/api/v1/finance/invoices/{iid}", headers=h)
    assert chk.json()["data"]["ocr_review_status"] == "ACCEPTED"

    lo = client.post("/api/v1/supplier-portal/auth/login", json={"username": uname, "password": pwd})
    assert lo.status_code == 200, lo.text
    tok = lo.json()["data"]["access_token"]
    plist = client.get("/api/v1/supplier-portal/invoices", headers={"Authorization": f"Bearer {tok}"})
    assert plist.status_code == 200
    items = plist.json()["data"]["items"]
    assert any(str(x["id"]) == str(iid) for x in items)

    pdetail = client.get(
        f"/api/v1/supplier-portal/invoices/{iid}",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert pdetail.status_code == 200, pdetail.text
    pj = pdetail.json()["data"]
    assert str(pj["id"]) == str(iid)
    assert pj["ocr_review_status"] == "ACCEPTED"
    assert "ocr_result" in pj

    ghost = uuid.uuid4()
    assert (
        client.get(
            f"/api/v1/supplier-portal/invoices/{ghost}",
            headers={"Authorization": f"Bearer {tok}"},
        ).status_code
        == 404
    )


def test_payables_payment_aging_and_payment_priority_ai(
    client: TestClient,
    require_postgres_finance,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    org_id = uuid.uuid4()
    acc_id = uuid.uuid4()
    uname = f"pytest_fin_pay_u_{suf}"
    pwd = "FinPw-123!!kk"

    db = SessionLocal()
    try:
        db.add(SupplierOrganization(id=org_id, legal_name=f"pytest_fin_org_{suf}", short_name="P"))
        db.add(
            SupplierPortalAccount(
                id=acc_id,
                organization_id=org_id,
                username=uname,
                password_hash=hash_password(pwd),
                display_name="付款门户",
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    pc = client.post(
        "/api/v1/finance/payables",
        headers=h,
        json={
            "supplier_id": str(org_id),
            "title": "集成应付",
            "amount_due": "80000",
            "due_date": "2026-03-15",
        },
    )
    assert pc.status_code == 200, pc.text
    payable_id = uuid.UUID(str(pc.json()["data"]["id"]))

    pb = client.get("/api/v1/finance/payables", headers=h, params={"supplier_id": str(org_id)})
    assert pb.status_code == 200, pb.text
    assert pb.json()["data"]["total"] >= 1

    ag = client.get("/api/v1/finance/aging-analysis", headers=h, params={"supplier_id": str(org_id)})
    assert ag.status_code == 200, ag.text
    assert ag.json()["data"]["open_count"] >= 1
    assert "buckets" in ag.json()["data"]

    pr = client.post("/api/v1/finance/payment-priority/ai-analyze", headers=h, json={})
    assert pr.status_code == 200, pr.text
    out = pr.json()["data"]["result"]["output_payload"]
    pl = out["priority_suggestions"]
    assert isinstance(pl, list)
    assert any(x.get("payable_id") == str(payable_id) for x in pl)

    lo = client.post("/api/v1/supplier-portal/auth/login", json={"username": uname, "password": pwd})
    assert lo.status_code == 200, lo.text
    ph = {"Authorization": f'Bearer {lo.json()["data"]["access_token"]}'}

    spb = client.get("/api/v1/supplier-portal/payables", headers=ph)
    assert spb.status_code == 200, spb.text
    assert any(str(x["id"]) == str(payable_id) for x in spb.json()["data"]["items"])
    spb1 = client.get(f"/api/v1/supplier-portal/payables/{payable_id}", headers=ph)
    assert spb1.status_code == 200, spb1.text
    assert "supplier_id" not in spb1.json()["data"]
    assert uuid.UUID(str(spb1.json()["data"]["organization_id"])) == org_id
    assert client.get(f"/api/v1/supplier-portal/payables/{uuid.uuid4()}", headers=ph).status_code == 404

    pay = client.post(
        "/api/v1/finance/payments",
        headers=h,
        json={
            "supplier_id": str(org_id),
            "payment_amount": "30000",
            "payment_date": "2026-05-08",
            "allocations": [{"payable_id": str(payable_id), "allocated_amount": "30000"}],
        },
    )
    assert pay.status_code == 200, pay.text
    pay_data = pay.json()["data"]
    pay_uid = pay_data["id"]
    assert pay_data["payment_amount"] == 30000.0
    assert pay_data["allocations"][0]["payable_id"] == str(payable_id)

    pay_list = client.get("/api/v1/supplier-portal/payments", headers=ph)
    assert pay_list.status_code == 200, pay_list.text
    pitems = pay_list.json()["data"]["items"]
    assert pay_list.json()["data"]["total"] >= 1
    assert any(str(x["id"]) == str(pay_uid) for x in pitems)

    spd = client.get(
        f"/api/v1/supplier-portal/payments/{pay_uid}",
        headers=ph,
    )
    assert spd.status_code == 200, spd.text
    spd_j = spd.json()["data"]
    assert str(spd_j["id"]) == str(pay_uid)
    assert spd_j["payment_amount"] == 30000.0
    assert not any(k in spd_j for k in ("recorded_by_user_id", "supplier_id"))
    ghost_pay = uuid.uuid4()
    assert (
        client.get(
            f"/api/v1/supplier-portal/payments/{ghost_pay}",
            headers=ph,
        ).status_code
        == 404
    )

    pg_one = client.get(f"/api/v1/finance/payables/{payable_id}", headers=h)
    assert pg_one.status_code == 200
    assert uuid.UUID(str(pg_one.json()["data"]["id"])) == payable_id

    pls = client.get("/api/v1/finance/payments", headers=h, params={"supplier_id": str(org_id)})
    assert pls.status_code == 200, pls.text
    assert pls.json()["data"]["total"] >= 1
    assert any(str(x["id"]) == str(pay_uid) for x in pls.json()["data"]["items"])

    pone = client.get(f"/api/v1/finance/payments/{pay_uid}", headers=h)
    assert pone.status_code == 200, pone.text
    assert str(pone.json()["data"]["id"]) == str(pay_uid)

    db = SessionLocal()
    try:
        row = db.get(Payable, payable_id)
        assert row is not None
        assert row.amount_paid == Decimal("30000.00")
        assert row.status == "OPEN"
    finally:
        db.close()
