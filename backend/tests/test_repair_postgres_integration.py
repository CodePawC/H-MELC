"""报修维修集成测试：需 PostgreSQL + Alembic（含 e003 repair schema）。

对齐：docs/06_接口设计/01 §二 · docs/03_数据库设计/04 §三
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("集成测试需在 PostgreSQL + Alembic 迁移后的环境运行")
    if not pg_schema_has_table(engine, schema="repair", name="repair_order"):
        pytest.skip("需 PostgreSQL 已执行 alembic（repair.repair_order · e003 等）")


def test_repair_lifecycle_accept(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    engineer_id = str(uuid.uuid4())
    dept_id = str(uuid.uuid4())
    fid = str(uuid.uuid4())

    cre_a = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": f"R-{uuid.uuid4().hex[:10]}",
            "asset_name": "pytest 轮椅",
            "main_status": "ACTIVE",
        },
    )
    assert cre_a.status_code == 200
    aid = cre_a.json()["data"]["id"]

    cre = client.post(
        "/api/v1/repairs",
        headers=h,
        json={
            "asset_id": aid,
            "fault_description": "无法升降",
            "fault_type": "MECHANICAL",
            "priority": "HIGH",
            "report_department_id": dept_id,
            "reporter_name": "护士A",
            "attachments": [{"file_id": fid, "file_type": "IMAGE"}],
        },
    )
    assert cre.status_code == 200, cre.text
    oid = cre.json()["data"]["id"]

    lst = client.get("/api/v1/repairs", params={"asset_id": aid}, headers=h)
    assert lst.status_code == 200
    assert lst.json()["data"]["total"] >= 1

    det_before = client.get(f"/api/v1/repairs/{oid}", headers=h)
    assert det_before.status_code == 200
    assert len(det_before.json()["data"]["attachments"]) == 1

    assert (
        client.post(
            f"/api/v1/repairs/{oid}/claim",
            headers=h,
            json={"engineer_id": engineer_id},
        ).status_code
        == 200
    )

    rec = client.post(
        f"/api/v1/repairs/{oid}/records",
        headers=h,
        json={"record_type": "NOTE", "content": "拆解检查", "engineer_id": engineer_id},
    )
    assert rec.status_code == 200

    done = client.post(
        f"/api/v1/repairs/{oid}/complete",
        headers=h,
        json={"fault_cause": "限位失灵", "conclusion": "更换限位开关", "actual_cost": "120.50"},
    )
    assert done.status_code == 200
    assert done.json()["data"]["order_status"] == "AWAIT_CONFIRM"

    conf = client.post(
        f"/api/v1/repairs/{oid}/confirm",
        headers=h,
        json={"confirm_status": "ACCEPTED", "comment": "正常使用"},
    )
    assert conf.status_code == 200
    assert conf.json()["data"]["order_status"] == "CLOSED"

    adetail = client.get(f"/api/v1/assets/{aid}", headers=h)
    assert adetail.status_code == 200
    assert isinstance(adetail.json()["data"]["repairs"], list)
    assert any(x["id"] == oid for x in adetail.json()["data"]["repairs"])


def test_repair_confirm_rejected_reopens(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    eng = str(uuid.uuid4())
    cre_a = client.post(
        "/api/v1/assets",
        headers=h,
        json={"asset_code": f"R-{uuid.uuid4().hex[:10]}", "asset_name": "泵", "main_status": "ACTIVE"},
    )
    assert cre_a.status_code == 200
    aid = cre_a.json()["data"]["id"]
    oid = client.post("/api/v1/repairs", headers=h, json={"asset_id": aid, "fault_description": "漏液"}).json()[
        "data"
    ]["id"]
    assert client.post(f"/api/v1/repairs/{oid}/claim", headers=h, json={"engineer_id": eng}).status_code == 200
    assert (
        client.post(f"/api/v1/repairs/{oid}/complete", headers=h, json={"conclusion": "已处理"}).status_code == 200
    )
    rej = client.post(
        f"/api/v1/repairs/{oid}/confirm",
        headers=h,
        json={"confirm_status": "REJECTED", "comment": "仍异响"},
    )
    assert rej.status_code == 200
    assert rej.json()["data"]["order_status"] == "IN_PROGRESS"


def test_force_assign_puts_record(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    cre_a = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": f"R-{uuid.uuid4().hex[:10]}",
            "asset_name": "监护仪",
            "main_status": "ACTIVE",
        },
    )
    assert cre_a.status_code == 200
    aid = cre_a.json()["data"]["id"]
    oid = client.post("/api/v1/repairs", headers=h, json={"asset_id": aid, "fault_description": "黑屏"}).json()[
        "data"
    ]["id"]
    eng = str(uuid.uuid4())
    asg = client.post(
        f"/api/v1/repairs/{oid}/assign",
        headers=h,
        json={"engineer_id": eng, "reason": "急救设备故障，强制派单"},
    )
    assert asg.status_code == 200
    bundle = client.get(f"/api/v1/repairs/{oid}", headers=h).json()["data"]
    assert bundle["order"]["assigned_engineer_id"] == eng
    assert any(r.get("record_type") == "ASSIGN" for r in bundle["records"])
