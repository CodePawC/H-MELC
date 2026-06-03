from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt

from app.modules.asset.schemas import AssetCreate
from app.modules.hmdm.client import HmdmClientError


def _partner_record() -> dict:
    return {
        "id": "org-mindray",
        "org_id": "org-mindray",
        "organization_code": "BP-MINDRAY",
        "org_code": "BP-MINDRAY",
        "standard_name": "深圳迈瑞生物医疗电子股份有限公司",
        "org_name": "深圳迈瑞生物医疗电子股份有限公司",
        "short_name": "迈瑞",
        "unified_social_credit_code": "91440300708461136T",
        "source": "h-umdg",
        "version": "BP-20260528",
        "status": "enabled",
        "roles": [
            {"id": "role-manufacturer", "role_type": "manufacturer", "role_name": "生产厂家", "business_domain": "equipment", "status": "enabled", "qualification_required": True},
            {"id": "role-supplier", "role_type": "supplier", "role_name": "供应商", "business_domain": "equipment", "status": "enabled"},
            {"id": "role-maintainer", "role_type": "maintainer", "role_name": "维保商", "business_domain": "service", "status": "enabled"},
        ],
        "qualifications": [
            {"id": "qual-production", "qualification_type": "医疗器械生产许可证", "certificate_no": "粤食药监械生产许", "status": "enabled"}
        ],
        "mdm_external_mappings": [
            {"id": "map-hrp", "source_system": "HRP", "external_code": "HRP-MINDRAY", "external_name": "深圳迈瑞", "mapping_confidence": 1, "status": "enabled"}
        ],
    }


def _partner_list_payload() -> dict:
    return {"data": {"records": [_partner_record()], "total": 1}}


def _partner_match_payload() -> dict:
    item = _partner_record() | {"confidence": 96, "matchBasis": ["单位名称“深圳迈瑞”别名/简称匹配"], "hasRequiredRole": True, "degraded": False}
    return {"data": {"connected": True, "source": "h-umdg", "degraded": False, "recommendation": item, "candidates": [item]}}


def test_os_business_partner_selector_role_filter(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, **_: object) -> dict:
        assert path == "/api/v1/master-data/business-partners"
        assert params and params["roleType"] == "生产厂家"
        return _partner_list_payload()

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    res = client.get("/api/v1/mdm/business-partners/search", headers=h, params={"keyword": "迈瑞", "role_type": "生产厂家"})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["connected"] is True
    assert data["source"] == "h-umdg"
    assert data["items"][0]["id"] == "org-mindray"
    assert data["items"][0]["roles"][0]["roleType"] == "manufacturer"
    assert data["items"][0]["hasOriginalFactoryAuthorization"] is True


def test_asset_can_reference_same_business_partner_for_multiple_roles(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"MDM-BP-{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": code,
            "asset_name": "pytest 往来单位引用设备",
            "main_status": "ACTIVE",
            "manufacturer_org_id": "org-mindray",
            "manufacturer_org_code": "BP-MINDRAY",
            "manufacturer_name": "深圳迈瑞生物医疗电子股份有限公司",
            "supplier_org_id": "org-mindray",
            "supplier_org_code": "BP-MINDRAY",
            "supplier_name": "深圳迈瑞生物医疗电子股份有限公司",
            "maintainer_org_id": "org-mindray",
            "maintainer_org_code": "BP-MINDRAY",
            "maintainer_name": "深圳迈瑞生物医疗电子股份有限公司",
            "org_source": "h-mdm",
            "org_version": "BP-20260528",
        },
    )
    assert res.status_code in (200, 503), res.text
    if res.status_code == 503:
        return
    data = res.json()["data"]
    assert data["manufacturer_org_id"] == "org-mindray"
    assert data["supplier_org_id"] == "org-mindray"
    assert data["maintainer_org_id"] == "org-mindray"
    assert data["org_source"] == "h-umdg"
    assert data["org_synced_at"]


def test_asset_schema_rejects_non_hmdm_business_partner_reference() -> None:
    with pytest.raises(ValueError):
        AssetCreate(
            asset_code="PYTEST-BP-FALLBACK",
            asset_name="往来单位降级测试设备",
            manufacturer_org_id="local-org",
            manufacturer_name="本地厂家",
            org_source="fallback",
        )


def test_intake_matches_manufacturer_name_to_hmdm_business_partner(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not pg_schema_has_table(engine, schema="asset", name="asset_intake_task"):
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, json: dict | None = None, **_: object) -> dict:
        if path == "/api/v1/master-data/device-classification/catalog":
            return {
                "data": {
                    "records": [
                        {"id": "cat-monitor", "code": "07-04-01", "name": "病人监护设备", "path": "医疗器械分类目录 / 医用电子仪器设备 / 病人监护设备", "source": "h-umdg", "version": "CAT-20260528", "status": "ACTIVE"}
                    ],
                    "total": 1,
                }
            }
        if path == "/api/v1/master-data/business-partners/match":
            assert json and json["keyword"]
            return _partner_match_payload()
        if path == "/api/v1/master-data/standard-equipment-library":
            return {
                "data": {
                    "records": [
                        {"id": "standard-equipment-monitor", "code": "STD-EQ-MONITOR", "name": "病人监护仪", "generic_name": "病人监护仪", "category_name": "患者监护设备", "management_class": "II", "status": "ACTIVE"}
                    ],
                    "total": 1,
                }
            }
        if path in ("/api/v1/master-data/equipment-brand-models", "/api/v1/master-data/registration-certificates", "/api/v1/master-data/udis"):
            return {"data": {"records": [], "total": 0}}
        raise AssertionError(path)

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    task = client.post("/api/v1/assets/intake/tasks", headers=h, json={"title": "pytest 智能建档", "mode": "single"}).json()["data"]
    client.post(f"/api/v1/assets/intake/tasks/{task['id']}/extract", headers=h)
    matched = client.post(f"/api/v1/assets/intake/tasks/{task['id']}/match-mdm", headers=h)
    assert matched.status_code == 200, matched.text
    result = matched.json()["data"]["mdm_match_result"]
    assert result["manufacturerRecommendation"]["id"] == "org-mindray"
    assert result["manufacturerRecommendation"]["source"] == "h-umdg"
    assert result["manufacturerRecommendation"]["confidence"] == 96


def test_hmdm_business_partner_api_key_error_does_not_clear_os_auth(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(*_: object, **__: object) -> dict:
        raise HmdmClientError("401 Unauthorized", status_code=401)

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    res = client.get("/api/v1/mdm/business-partners/search", headers=h, params={"keyword": "迈瑞"})
    assert res.status_code == 502, res.text
    assert "主数据服务接口鉴权失败" in res.json()["detail"]

    me = client.get("/api/v1/auth/me", headers=h)
    assert me.status_code == 200, me.text
