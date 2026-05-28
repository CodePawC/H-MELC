from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt

from app.modules.hmdm.client import HmdmClientError
from app.modules.asset.schemas import AssetCreate


def _catalog_payload() -> dict:
    return {
        "data": {
            "records": [
                {
                    "id": "hmdm-patient-monitor",
                    "code": "07-04-01",
                    "name": "病人监护设备",
                    "parentId": "07-04",
                    "level": 3,
                    "majorCategoryName": "医用诊察和监护器械",
                    "level1CategoryName": "生理参数分析测量设备",
                    "level2CategoryName": "监护设备",
                    "managementClass": "II",
                    "sourceBatchId": "v0.8.5+20260525.003",
                    "status": "ACTIVE",
                }
            ],
            "total": 1,
        }
    }


def test_mdm_device_categories_proxy_success(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, **_: object) -> dict:
        assert path == "/api/v1/master-data/device-classification/catalog"
        assert params and params["keyword"] == "病人监护设备"
        return _catalog_payload()

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    res = client.get("/api/v1/mdm/device-categories/search", headers=h, params={"keyword": "病人监护设备"})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["connected"] is True
    assert data["source"] == "h-mdm"
    assert data["degraded"] is False
    assert data["items"][0]["name"] == "病人监护设备"
    assert data["items"][0]["path"] == "医用诊察和监护器械 / 生理参数分析测量设备 / 监护设备 / 病人监护设备"


def test_mdm_device_categories_hmdm_unauthorized_is_not_os_auth(
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
    res = client.get("/api/v1/mdm/device-categories", headers=h, params={"keyword": "病人监护设备"})
    assert res.status_code == 502, res.text
    assert "H-UMDG 接口鉴权失败" in res.json()["detail"]


def test_mdm_reference_schema_rejects_degraded_source() -> None:
    with pytest.raises(ValueError):
        AssetCreate(
            asset_code="PYTEST-DEGRADED",
            asset_name="降级分类测试设备",
            mdm_category_id="fallback-1",
            mdm_category_code="FB-001",
            mdm_category_name="本地样例分类",
            mdm_source="fallback",
        )


def test_asset_mdm_category_reference_roundtrip_if_pg_ready(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"MDM-CAT-{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": code,
            "asset_name": "pytest 病人监护设备",
            "main_status": "ACTIVE",
            "mdm_category_id": "hmdm-patient-monitor",
            "mdm_category_code": "07-04-01",
            "mdm_category_name": "病人监护设备",
            "mdm_category_path": "医用诊察和监护器械 / 生理参数分析测量设备 / 监护设备 / 病人监护设备",
            "mdm_category_version": "v0.8.5+20260525.003",
            "mdm_source": "h-mdm",
            "management_class": "II",
        },
    )
    assert create.status_code in (200, 503), create.text
    if create.status_code == 503:
        return
    asset = create.json()["data"]
    assert asset["mdm_source"] == "h-mdm"
    assert asset["mdm_category_name"] == "病人监护设备"
    assert asset["classification_code"] == "07-04-01"
    assert asset["mdm_synced_at"]

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=h)
    assert detail.status_code == 200
    detail_asset = detail.json()["data"]["asset"]
    assert detail_asset["mdm_category_path"].endswith("病人监护设备")
