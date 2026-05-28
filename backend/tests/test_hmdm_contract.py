from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


def assert_api_envelope(body: dict[str, object]) -> None:
    assert set(body.keys()) >= {"code", "message", "data"}
    assert body["code"] == 0


def test_hmdm_root_boundary_contract(client: TestClient) -> None:
    res = client.get("/api/v1/hmdm")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    data = body["data"]
    assert data["module"] == "hmdm"
    assert "另一个系统" in data["boundary"]
    assert data["paths"]["status"] == "/api/v1/hmdm/status"


def test_hmdm_status_requires_pg_and_auth(client: TestClient) -> None:
    from app.db.session import engine

    res = client.get("/api/v1/hmdm/status")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    if not pg_schema_has_table(engine, schema="integration", name="hmdm_dictionary_cache"):
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_hmdm_proxy_routes_require_auth_by_dialect(client: TestClient) -> None:
    from app.db.session import engine

    calls = [
        ("GET", "/api/v1/hmdm/equipment-categories/tree", None),
        ("GET", "/api/v1/hmdm/equipment-standard-names", None),
        ("GET", "/api/v1/hmdm/manufacturer-vendors", None),
        ("GET", "/api/v1/hmdm/cache/status", None),
        ("POST", "/api/v1/hmdm/cache/refresh", {}),
        ("POST", "/api/v1/hmdm/equipment-standard-name-requests", {"proposed_name": "x", "reason": "测试申请"}),
        ("POST", "/api/v1/hmdm/manufacturer-vendor-requests", {"proposed_standard_name": "x", "reason": "测试申请"}),
    ]
    for method, path, body in calls:
        res = client.request(method, path, json=body)
        if engine.dialect.name != "postgresql":
            assert res.status_code == 503, path
        elif not pg_schema_has_table(engine, schema="integration", name="hmdm_dictionary_cache"):
            assert res.status_code == 503, path
        else:
            assert res.status_code == 401, path


def test_asset_hmdm_reference_fields_roundtrip_if_pg_ready(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"HMDM-{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": code,
            "asset_name": "pytest H-UMDG 引用设备",
            "main_status": "ACTIVE",
            "hmdm_equipment_category_code": "CAT-001",
            "hmdm_equipment_category_name": "生命支持设备",
            "hmdm_equipment_name_code": "EQN-VENT",
            "hmdm_standard_name": "呼吸机",
            "hmdm_management_class": "III",
            "manufacturer_org_code": "ORG-MINDRAY",
            "manufacturer_name": "深圳迈瑞生物医疗电子股份有限公司",
            "supplier_org_code": "ORG-SUP-001",
            "supplier_name": "测试供应商",
            "after_sales_org_code": "ORG-AS-001",
            "after_sales_name": "测试售后服务商",
        },
    )
    assert create.status_code in (200, 503), create.text
    if create.status_code == 503:
        return
    data = create.json()["data"]
    assert data["hmdm_equipment_name_code"] == "EQN-VENT"
    assert data["manufacturer_org_code"] == "ORG-MINDRAY"
    detail = client.get(f"/api/v1/assets/{data['id']}", headers=h)
    assert detail.status_code == 200
    asset = detail.json()["data"]["asset"]
    assert asset["hmdm_standard_name"] == "呼吸机"
    assert asset["supplier_name"] == "测试供应商"
