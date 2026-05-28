from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt

from app.modules.asset.schemas import AssetCreate
from app.modules.hmdm.client import HmdmClientError


def _department_payload() -> dict:
    return {
        "data": {
            "records": [
                {
                    "id": "dept-icu-01",
                    "code": "DEPT-ICU-01",
                    "name": "ICU一病区",
                    "shortName": "ICU",
                    "campusId": "campus-main",
                    "campusCode": "MAIN",
                    "campusName": "主院区",
                    "type": "临床科室",
                    "isClinical": True,
                    "wardFlag": True,
                    "source": "h-mdm",
                    "version": "ORG-MDM-20260528",
                    "status": "ACTIVE",
                }
            ],
            "total": 1,
        }
    }


def _person_payload() -> dict:
    return {
        "data": {
            "records": [
                {
                    "id": "person-zhang",
                    "code": "P-ZHANG-ICU",
                    "employeeNo": "E1001",
                    "name": "张主任",
                    "departmentId": "dept-icu-01",
                    "departmentCode": "DEPT-ICU-01",
                    "departmentName": "ICU一病区",
                    "campusId": "campus-main",
                    "campusName": "主院区",
                    "type": "医生",
                    "source": "h-mdm",
                    "version": "ORG-MDM-20260528",
                    "status": "ACTIVE",
                }
            ],
            "total": 1,
        }
    }


def test_os_backend_gets_hmdm_department_tree(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, **_: object) -> dict:
        assert path == "/api/v1/master-data/departments/tree"
        return _department_payload()

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    res = client.get("/api/v1/mdm/departments/tree", headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["connected"] is True
    assert data["source"] == "h-mdm"
    assert data["degraded"] is False
    assert data["items"][0]["name"] == "ICU一病区"
    assert data["items"][0]["campusName"] == "主院区"


def test_os_backend_searches_hmdm_persons(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, **_: object) -> dict:
        assert path == "/api/v1/master-data/persons"
        assert params and params["keyword"] == "张主任"
        return _person_payload()

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    res = client.get("/api/v1/mdm/persons/search", headers=h, params={"keyword": "张主任"})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["connected"] is True
    assert data["items"][0]["name"] == "张主任"
    assert data["items"][0]["departmentName"] == "ICU一病区"


def test_asset_schema_rejects_non_hmdm_org_reference() -> None:
    with pytest.raises(ValueError):
        AssetCreate(
            asset_code="PYTEST-ORG-DEGRADED",
            asset_name="组织降级测试设备",
            mdm_department_id="local-dept",
            department_code="LOCAL",
            department_name="本地科室",
            department_source="fallback",
        )


def test_asset_can_save_hmdm_department_person_discipline_refs(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"MDM-ORG-{uuid.uuid4().hex[:8]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": code,
            "asset_name": "pytest 组织主数据设备",
            "main_status": "ACTIVE",
            "department_name": "ICU一病区",
            "campus_id": "campus-main",
            "campus_code": "MAIN",
            "campus_name": "主院区",
            "mdm_department_id": "dept-icu-01",
            "department_code": "DEPT-ICU-01",
            "department_source": "h-mdm",
            "department_version": "ORG-MDM-20260528",
            "mdm_person_id": "person-zhang",
            "person_code": "P-ZHANG-ICU",
            "person_name": "张主任",
            "person_department_id": "dept-icu-01",
            "person_department_name": "ICU一病区",
            "person_source": "h-mdm",
            "person_version": "ORG-MDM-20260528",
            "mdm_discipline_id": "disc-ccm",
            "discipline_code": "DISC-CCM",
            "discipline_name": "重症医学",
            "discipline_source": "h-mdm",
            "discipline_version": "ORG-MDM-20260528",
        },
    )
    assert create.status_code in (200, 503), create.text
    if create.status_code == 503:
        return
    asset = create.json()["data"]
    assert asset["department_source"] == "h-mdm"
    assert asset["department_synced_at"]
    assert asset["person_source"] == "h-mdm"
    assert asset["person_synced_at"]
    assert asset["discipline_source"] == "h-mdm"
    assert asset["discipline_synced_at"]


def test_hmdm_org_api_key_error_does_not_clear_os_auth(
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
    res = client.get("/api/v1/mdm/persons/search", headers=h, params={"keyword": "张主任"})
    assert res.status_code == 502, res.text
    assert "H-UMDG 接口鉴权失败" in res.json()["detail"]

    me = client.get("/api/v1/auth/me", headers=h)
    assert me.status_code == 200, me.text
