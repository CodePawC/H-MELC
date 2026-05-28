from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt

from app.modules.hmdm.client import HmdmClientError


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


def _partner_match_payload() -> dict:
    item = {
        "id": "org-mindray",
        "org_id": "org-mindray",
        "organization_code": "BP-MINDRAY",
        "org_code": "BP-MINDRAY",
        "standard_name": "深圳迈瑞生物医疗电子股份有限公司",
        "org_name": "深圳迈瑞生物医疗电子股份有限公司",
        "short_name": "迈瑞",
        "source": "h-mdm",
        "version": "BP-20260528",
        "confidence": 96,
        "matchBasis": ["单位名称匹配"],
        "hasRequiredRole": True,
        "degraded": False,
    }
    return {"data": {"connected": True, "source": "h-mdm", "degraded": False, "recommendation": item, "candidates": [item]}}


def _requires_pg_asset_tables() -> bool:
    from app.db.session import engine

    return (
        engine.dialect.name == "postgresql"
        and pg_schema_has_table(engine, schema="asset", name="asset")
        and pg_schema_has_table(engine, schema="asset", name="asset_intake_task")
    )


def test_asset_intake_ocr_hmdm_review_create_asset_flow(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if not _requires_pg_asset_tables():
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(path: str, params: dict | None = None, json: dict | None = None, **_: object) -> dict:
        if path == "/api/v1/master-data/device-classification/catalog":
            assert params
            return _catalog_payload()
        if path == "/api/v1/master-data/business-partners/match":
            assert json and json["keyword"]
            return _partner_match_payload()
        raise AssertionError(path)

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)

    task_res = client.post(
        "/api/v1/assets/intake/tasks",
        headers=h,
        json={"title": "pytest 智能建档", "mode": "single", "intake_source": "nameplate_photo"},
    )
    assert task_res.status_code == 200, task_res.text
    task = task_res.json()["data"]
    task_id = task["id"]

    file_res = client.post(
        f"/api/v1/assets/intake/tasks/{task_id}/files",
        headers=h,
        json={
            "file_name": "nameplate.jpg",
            "file_type": "nameplate_photo",
            "mime_type": "image/jpeg",
            "size_bytes": 2048,
        },
    )
    assert file_res.status_code == 200, file_res.text
    assert file_res.json()["data"]["archive_status"] == "raw_archived"

    extract = client.post(f"/api/v1/assets/intake/tasks/{task_id}/extract", headers=h, json={})
    assert extract.status_code == 200, extract.text
    extracted = extract.json()["data"]
    assert extracted["ai_extraction_status"] == "mock_completed"
    assert extracted["ai_extraction_raw_result"]["provider"]["mock"] is True
    assert extracted["extracted_fields"]["basic"]["device_name"]["value"] == "病人监护仪"
    assert extracted["extracted_fields"]["basic"]["model"]["value"] == "iPM12"
    assert extracted["extracted_fields"]["basic"]["manufacturer_name"]["value"]
    assert extracted["extracted_fields"]["basic"]["serial_number"]["value"]

    match = client.post(f"/api/v1/assets/intake/tasks/{task_id}/match-mdm", headers=h, json={})
    assert match.status_code == 200, match.text
    matched = match.json()["data"]
    result = matched["mdm_match_result"]
    assert result["connected"] is True
    assert result["source"] == "h-mdm"
    assert result["degraded"] is False
    assert result["categoryRecommendation"]["name"] == "病人监护设备"
    assert result["categoryRecommendation"]["source"] == "h-mdm"
    assert result["categoryRecommendation"]["confidence"] >= 90

    review = client.post(
        f"/api/v1/assets/intake/tasks/{task_id}/review",
        headers=h,
        json={
            "review_payload": {
                **matched["review_payload"],
                "mdmDepartment": {
                    "id": "dept-icu-01",
                    "code": "DEPT-ICU-01",
                    "name": "ICU一病区",
                    "campusId": "campus-main",
                    "campusCode": "MAIN",
                    "campusName": "主院区",
                    "source": "h-mdm",
                    "version": "ORG-MDM-20260528",
                },
                "mdmPerson": {
                    "id": "person-zhang",
                    "code": "P-ZHANG-ICU",
                    "name": "张主任",
                    "departmentId": "dept-icu-01",
                    "departmentName": "ICU一病区",
                    "source": "h-mdm",
                    "version": "ORG-MDM-20260528",
                },
                "mdmDiscipline": {
                    "id": "disc-ccm",
                    "code": "DISC-CCM",
                    "name": "重症医学",
                    "source": "h-mdm",
                    "version": "ORG-MDM-20260528",
                },
            },
            "selected_mdm_category": result["categoryRecommendation"],
            "review_status": "pending_review",
        },
    )
    assert review.status_code == 200, review.text
    assert review.json()["data"]["ai_review_status"] == "pending_review"

    approve = client.post(f"/api/v1/assets/intake/tasks/{task_id}/approve", headers=h, json={})
    assert approve.status_code == 200, approve.text
    assert approve.json()["data"]["ai_review_status"] == "approved"

    code = f"AI-PYTEST-{uuid.uuid4().hex[:8]}"
    create = client.post(
        f"/api/v1/assets/intake/tasks/{task_id}/create-asset",
        headers=h,
        json={"asset_code": code},
    )
    assert create.status_code == 200, create.text
    asset = create.json()["data"]["asset"]
    assert asset["asset_code"] == code
    assert asset["mdm_category_id"] == "hmdm-patient-monitor"
    assert asset["mdm_category_code"] == "07-04-01"
    assert asset["mdm_category_name"] == "病人监护设备"
    assert asset["mdm_category_path"].endswith("病人监护设备")
    assert asset["mdm_source"] == "h-mdm"
    assert asset["mdm_department_id"] == "dept-icu-01"
    assert asset["department_code"] == "DEPT-ICU-01"
    assert asset["department_source"] == "h-mdm"
    assert asset["mdm_person_id"] == "person-zhang"
    assert asset["person_name"] == "张主任"
    assert asset["mdm_discipline_id"] == "disc-ccm"
    assert asset["discipline_name"] == "重症医学"
    assert asset["ai_review_status"] == "approved"
    assert asset["source_file_ids"]


def test_asset_intake_degraded_mdm_category_cannot_create_asset(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    if not _requires_pg_asset_tables():
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    task = client.post("/api/v1/assets/intake/tasks", headers=h, json={}).json()["data"]
    task_id = task["id"]
    extract = client.post(f"/api/v1/assets/intake/tasks/{task_id}/extract", headers=h, json={})
    assert extract.status_code == 200
    review_payload = extract.json()["data"]["review_payload"]
    degraded_category = {
        "id": "local-sample",
        "code": "LOCAL-001",
        "name": "本地样例分类",
        "path": "本地样例分类",
        "source": "fallback",
        "degraded": True,
    }
    review = client.post(
        f"/api/v1/assets/intake/tasks/{task_id}/review",
        headers=h,
        json={
            "review_payload": review_payload,
            "selected_mdm_category": degraded_category,
            "review_status": "pending_review",
        },
    )
    assert review.status_code == 200
    approve = client.post(f"/api/v1/assets/intake/tasks/{task_id}/approve", headers=h, json={})
    assert approve.status_code == 409
    assert "不允许作为正式主数据引用保存" in approve.json()["detail"]


def test_hmdm_api_key_error_does_not_clear_os_auth_in_asset_intake(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if not _requires_pg_asset_tables():
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    async def fake_request(*_: object, **__: object) -> dict:
        raise HmdmClientError("401 Unauthorized", status_code=401)

    monkeypatch.setattr("app.modules.hmdm.client.request_json", fake_request)
    task = client.post("/api/v1/assets/intake/tasks", headers=h, json={}).json()["data"]
    task_id = task["id"]
    client.post(f"/api/v1/assets/intake/tasks/{task_id}/extract", headers=h, json={})
    match = client.post(f"/api/v1/assets/intake/tasks/{task_id}/match-mdm", headers=h, json={})
    assert match.status_code == 200, match.text
    result = match.json()["data"]["mdm_match_result"]
    assert result["authFailed"] is True
    assert result["degraded"] is True
    assert "H-UMDG 接口鉴权失败" in result["message"]

    me = client.get("/api/v1/auth/me", headers=h)
    assert me.status_code == 200, me.text
