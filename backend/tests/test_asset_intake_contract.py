from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt

from app.modules.hmdm.client import HmdmClientError

ROOT = Path(__file__).resolve().parents[2]


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
                    "source": "h-umdg",
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


def _as_humdg(value):
    if isinstance(value, dict):
        out = {key: _as_humdg(item) for key, item in value.items()}
        if out.get("source") == "h-mdm":
            out["source"] = "h-umdg"
        return out
    if isinstance(value, list):
        return [_as_humdg(item) for item in value]
    return value


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
        if path == "/api/v1/master-data/equipment-brand-models":
            return {
                "data": {
                    "records": [
                        {
                            "id": "brand-model-monitor-n15",
                            "code": "BM-MINDRAY-N15",
                            "name": "迈瑞 BeneVision N15",
                            "brand": "迈瑞",
                            "model": "BeneVision N15",
                            "generic_name": "病人监护仪",
                            "registration_no": "粤械注准20232070156",
                            "manufacturer_name": "深圳迈瑞生物医疗电子股份有限公司",
                            "status": "ACTIVE",
                        }
                    ],
                    "total": 1,
                }
            }
        if path == "/api/v1/master-data/standard-equipment-library":
            return {
                "data": {
                    "records": [
                        {
                            "id": "standard-equipment-monitor",
                            "code": "STD-EQ-MONITOR",
                            "name": "病人监护仪",
                            "generic_name": "病人监护仪",
                            "category_name": "患者监护设备",
                            "management_class": "II",
                            "status": "ACTIVE",
                        }
                    ],
                    "total": 1,
                }
            }
        if path == "/api/v1/master-data/registration-certificates":
            return {
                "data": {
                    "records": [
                        {
                            "id": "reg-monitor-n15",
                            "code": "粤械注准20232070156",
                            "registration_no": "粤械注准20232070156",
                            "name": "病人监护仪注册证",
                            "product_name": "病人监护仪",
                            "holder_name": "深圳迈瑞生物医疗电子股份有限公司",
                            "status": "ACTIVE",
                        }
                    ],
                    "total": 1,
                }
            }
        if path == "/api/v1/master-data/udis":
            return {
                "data": {
                    "records": [
                        {
                            "id": "udi-monitor-n15",
                            "code": "06900000000001",
                            "di": "06900000000001",
                            "name": "BeneVision N15 UDI-DI",
                            "product_name": "病人监护仪",
                            "registration_no": "粤械注准20232070156",
                            "status": "ACTIVE",
                        }
                    ],
                    "total": 1,
                }
            }
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
    assert result["source"] == "h-umdg"
    assert result["degraded"] is False
    assert result["categoryRecommendation"]["name"] == "病人监护设备"
    assert result["categoryRecommendation"]["source"] == "h-umdg"
    assert result["categoryRecommendation"]["confidence"] >= 90
    assert result["brandModelRecommendation"]["source"] == "h-umdg"
    assert result["brandModelRecommendation"]["payload"]["model"] == "BeneVision N15"
    assert result["standardEquipmentRecommendation"]["source"] == "h-umdg"
    assert result["registrationCertificateRecommendation"]["source"] == "h-umdg"
    assert result["registrationCertificateRecommendation"]["code"] == "粤械注准20232070156"
    assert result["udiRecommendation"]["source"] == "h-umdg"
    assert result["udiRecommendation"]["code"] == "06900000000001"
    assert result["registrationCertificateRecommendation"].get("mock") is not True
    assert result["udiRecommendation"].get("mock") is not True

    review = client.post(
        f"/api/v1/assets/intake/tasks/{task_id}/review",
        headers=h,
        json={
            "review_payload": _as_humdg({
                **matched["review_payload"],
                "manufacturer": {
                    "id": "org-mindray",
                    "code": "BP-MINDRAY",
                    "name": "深圳迈瑞生物医疗电子股份有限公司",
                    "source": "h-mdm",
                },
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
                "mdmLocation": {
                    "id": "room-icu-01",
                    "code": "ROOM-ICU-01",
                    "name": "ICU一病区设备间",
                    "path": "主院区 / 住院楼 / 8层 / ICU一病区设备间",
                    "type": "room",
                    "source": "h-mdm",
                    "version": "SPACE-MDM-20260602",
                },
                "mdmGenericName": {
                    "id": "generic-monitor",
                    "code": "GEN-MONITOR",
                    "name": "病人监护仪",
                    "source": "h-mdm",
                    "enabled": True,
                    "version": "GEN-20260602",
                    "payload": {
                        "generic_name": "病人监护仪",
                        "category_name": "患者监护设备",
                        "management_class": "II",
                    },
                },
                "mdmRegistrationCertificate": {
                    "id": "reg-monitor-n15",
                    "code": "粤械注准20232070156",
                    "name": "病人监护仪注册证",
                    "source": "h-mdm",
                    "enabled": True,
                    "payload": {
                        "registration_no": "粤械注准20232070156",
                        "product_name": "病人监护仪",
                        "generic_name": "病人监护仪",
                        "brand": "迈瑞",
                        "model": "BeneVision N15",
                        "holder_name": "深圳迈瑞生物医疗电子股份有限公司",
                        "valid_to": "2028-12-31",
                    },
                },
                "mdmBrandModel": {
                    "id": "brand-model-monitor-n15",
                    "code": "BM-MINDRAY-N15",
                    "name": "迈瑞 BeneVision N15",
                    "source": "h-mdm",
                    "enabled": True,
                    "payload": {
                        "brand": "迈瑞",
                        "model": "BeneVision N15",
                        "generic_name": "病人监护仪",
                        "standard_name": "病人监护仪",
                        "manufacturer_name": "深圳迈瑞生物医疗电子股份有限公司",
                        "registration_no": "粤械注准20232070156",
                    },
                },
                "mdmStandardEquipment": {
                    "id": "standard-equipment-monitor",
                    "code": "STD-EQ-MONITOR",
                    "name": "病人监护仪",
                    "source": "h-mdm",
                    "enabled": True,
                    "payload": {
                        "generic_name": "病人监护仪",
                        "category_code": "18-01",
                        "category_name": "患者监护设备",
                        "management_class": "II",
                        "brand": "迈瑞",
                        "model": "BeneVision N15",
                    },
                },
                "mdmUdi": {
                    "id": "udi-monitor-n15",
                    "code": "06900000000001",
                    "name": "BeneVision N15 UDI-DI",
                    "source": "h-mdm",
                    "enabled": True,
                    "payload": {
                        "di": "06900000000001",
                        "product_name": "病人监护仪",
                        "brand": "迈瑞",
                        "model": "BeneVision N15",
                        "registration_no": "粤械注准20232070156",
                    },
                },
            }),
            "selected_mdm_category": _as_humdg(result["categoryRecommendation"]),
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
    assert asset["mdm_source"] == "h-umdg"
    assert asset["mdm_department_id"] == "dept-icu-01"
    assert asset["department_code"] == "DEPT-ICU-01"
    assert asset["department_source"] == "h-umdg"
    assert asset["mdm_person_id"] == "person-zhang"
    assert asset["person_name"] == "张主任"
    assert asset["person_source"] == "h-umdg"
    assert asset["mdm_discipline_id"] == "disc-ccm"
    assert asset["discipline_name"] == "重症医学"
    assert asset["discipline_source"] == "h-umdg"
    assert asset["location"] == "主院区 / 住院楼 / 8层 / ICU一病区设备间"
    assert asset["mdm_location_id"] == "room-icu-01"
    assert asset["location_code"] == "ROOM-ICU-01"
    assert asset["location_name"] == "ICU一病区设备间"
    assert asset["location_source"] == "h-umdg"
    assert asset["location_snapshot"]["path"] == "主院区 / 住院楼 / 8层 / ICU一病区设备间"
    assert asset["hmdm_equipment_name_code"] == "GEN-MONITOR"
    assert asset["hmdm_standard_name"] == "病人监护仪"
    assert asset["registration_no"] == "粤械注准20232070156"
    assert asset["registration_certificate_id"] == "reg-monitor-n15"
    assert asset["registration_certificate_code"] == "粤械注准20232070156"
    assert asset["registration_certificate_name"] == "病人监护仪注册证"
    assert asset["registration_certificate_source"] == "h-umdg"
    assert asset["registration_certificate_snapshot"]["payload"]["holder_name"] == "深圳迈瑞生物医疗电子股份有限公司"
    assert asset["org_source"] == "h-umdg"
    assert asset["brand"] == "迈瑞"
    assert asset["model"] == "BeneVision N15"
    assert asset["brand_model_id"] == "brand-model-monitor-n15"
    assert asset["brand_model_code"] == "BM-MINDRAY-N15"
    assert asset["brand_model_source"] == "h-umdg"
    assert asset["brand_model_snapshot"]["payload"]["manufacturer_name"] == "深圳迈瑞生物医疗电子股份有限公司"
    assert asset["standard_equipment_id"] == "standard-equipment-monitor"
    assert asset["standard_equipment_code"] == "STD-EQ-MONITOR"
    assert asset["standard_equipment_name"] == "病人监护仪"
    assert asset["standard_equipment_source"] == "h-umdg"
    assert asset["standard_equipment_snapshot"]["payload"]["category_name"] == "患者监护设备"
    assert asset["udi_di"] == "06900000000001"
    assert asset["udi_id"] == "udi-monitor-n15"
    assert asset["udi_code"] == "06900000000001"
    assert asset["udi_name"] == "BeneVision N15 UDI-DI"
    assert asset["udi_source"] == "h-umdg"
    assert asset["udi_snapshot"]["payload"]["registration_no"] == "粤械注准20232070156"
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


def test_asset_create_page_uses_real_master_data_request_selector() -> None:
    root = Path(__file__).resolve().parents[2]
    create_page = (root / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx").read_text(encoding="utf-8")

    assert "提交主数据补充申请" in create_page
    assert "setCategorySelectorOpen(true)" in create_page
    assert "占位入口" not in create_page
    assert "Modal.info" not in create_page


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
    assert "主数据服务接口鉴权失败" in result["message"]

    me = client.get("/api/v1/auth/me", headers=h)
    assert me.status_code == 200, me.text


def test_asset_create_page_exposes_equipment_master_selectors() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx").read_text(encoding="utf-8")
    selector = (ROOT / "frontend-admin" / "src" / "components" / "RegistrationUdiSelector.tsx").read_text(encoding="utf-8")
    equipment_selector = (ROOT / "frontend-admin" / "src" / "components" / "EquipmentMasterSelector.tsx").read_text(encoding="utf-8")

    assert "RegistrationUdiSelector" in page
    assert "EquipmentMasterSelector" in page
    assert "mdmBrandModel" in page
    assert "mdmStandardEquipment" in page
    assert "mdmRegistrationCertificate" in page
    assert "mdmUdi" in page
    assert "选择标准品牌型号" in page
    assert "选择标准设备" in page
    assert "选择标准注册证" in page
    assert "选择标准 UDI" in page
    assert "searchRegistrationCertificates" in selector
    assert "searchUdis" in selector
    assert "searchBrandModels" in equipment_selector
    assert "searchStandardEquipment" in equipment_selector
    assert "connected=true" in selector
    assert "connected=true" in equipment_selector
    assert "genericMasterFromMatch" in page
    assert "brandModelRecommendation" in page
    assert "standardEquipmentRecommendation" in page
    assert "registrationCertificateRecommendation" in page
    assert "udiRecommendation" in page
    assert "masterReferenceChecklist" in page
    assert "关键主数据选择完整度" in page
    for label in [
        "分类目录",
        "使用科室",
        "责任人",
        "空间位置/机房",
        "通用名称",
        "标准设备",
        "品牌型号",
        "注册证",
        "UDI",
        "生产厂家",
        "供应商",
    ]:
        assert label in page
    assert "selectedReferenceCount" in page
    assert "已选" in page
    assert "待选" in page


def test_asset_detail_page_can_update_registration_and_udi_master_refs() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")
    api = (ROOT / "frontend-admin" / "src" / "api" / "assets.ts").read_text(encoding="utf-8")
    mdm_api = (ROOT / "frontend-admin" / "src" / "api" / "mdm.ts").read_text(encoding="utf-8")

    assert "RegistrationUdiSelector" in page
    assert "EquipmentMasterSelector" in page
    assert "选择标准设备" in page
    assert "选择标准品牌型号" in page
    assert "选择标准注册证" in page
    assert "选择标准 UDI" in page
    assert "handleStandardEquipmentSelect" in page
    assert "handleBrandModelSelect" in page
    assert "handleRegistrationSelect" in page
    assert "handleUdiSelect" in page
    assert "standard_equipment_source: masterSource(record)" in page
    assert "brand_model_source: masterSource(record)" in page
    assert "registration_certificate_source: masterSource(record)" in page
    assert "udi_source: masterSource(record)" in page
    assert "brand_model_version: record.version ??" in page
    assert "standard_equipment_version: record.version ??" in page
    assert "registration_certificate_version: record.version ??" in page
    assert "udi_version: record.version ??" in page
    assert "standard_equipment_snapshot" in page
    assert "brand_model_snapshot" in page
    assert "registration_certificate_snapshot" in page
    assert "udi_snapshot" in page
    assert "handleReferenceDetailLookup" in page
    assert "回查通用名称详情" in page
    assert "回查标准设备详情" in page
    assert "回查品牌型号详情" in page
    assert "回查注册证详情" in page
    assert "回查 UDI 详情" in page
    assert "此处为实时来源回查结果，不会覆盖本地档案快照。" in page
    for fn in [
        "fetchEquipmentGenericNameDetail",
        "fetchStandardEquipmentDetail",
        "fetchBrandModelDetail",
        "fetchRegistrationCertificateDetail",
        "fetchUdiDetail",
    ]:
        assert fn in page
        assert fn in mdm_api
    assert "standard_equipment_id?: string" in api
    assert "brand_model_id?: string" in api
    assert "registration_certificate_id?: string" in api
    assert "udi_id?: string" in api


def test_asset_detail_real_mode_does_not_mask_failed_api_with_mock_archive() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")
    fetch_failure_block = page.split("const bundle = await fetchAssetDetail(assetId)", 1)[1].split("} finally", 1)[0]

    assert "buildMockArchiveRows().find((item) => item.id === assetId)" in page
    assert "buildMockArchiveRows().find((item) => item.id === assetId)" not in fetch_failure_block
    assert "setMockRow(" not in fetch_failure_block
    assert "当前页面使用数字孪生演示画像兜底" not in page
    assert 'message="设备详情不可用"' in page
    assert "description={err ?? '未找到设备'}" in page


def test_asset_archive_classification_actions_open_real_detail_governance() -> None:
    archive_page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetsPage.tsx").read_text(encoding="utf-8")
    detail_page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")

    assert "useNavigate" in archive_page
    assert "openClassificationGovernance" in archive_page
    assert "/lifecycle/assets/${encodeURIComponent(row.id)}?tab=classification" in archive_page
    assert "重新匹配将调用" not in archive_page
    assert "classification-bind 并写入绑定日志" not in archive_page
    assert "联调时打开外部" not in archive_page
    assert "忽略本次变更将更新" not in archive_page
    assert "调整为新分类需要进入设备详情页" not in archive_page
    assert "useSearchParams" in detail_page
    assert "defaultActiveKey={initialTab}" in detail_page


def test_generic_equipment_master_mdm_mapping_exposes_version() -> None:
    schemas = (ROOT / "backend" / "app" / "modules" / "mdm" / "schemas.py").read_text(encoding="utf-8")
    service = (ROOT / "backend" / "app" / "modules" / "mdm" / "service.py").read_text(encoding="utf-8")
    frontend_api = (ROOT / "frontend-admin" / "src" / "api" / "mdm.ts").read_text(encoding="utf-8")

    assert "version: str | None = None" in schemas
    assert "version = _text(item.get(\"version\") or item.get(\"updated_at\") or item.get(\"updatedAt\"))" in service
    for typename in ["RegistrationCertificateMaster", "UdiMaster", "BrandModelMaster", "StandardEquipmentMaster"]:
        section = frontend_api.split(f"export type {typename}", 1)[1].split("payload:", 1)[0]
        assert "version?: string | null" in section


def test_asset_detail_page_can_update_org_people_and_location_refs() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")
    api = (ROOT / "frontend-admin" / "src" / "api" / "assets.ts").read_text(encoding="utf-8")
    mdm_api = (ROOT / "frontend-admin" / "src" / "api" / "mdm.ts").read_text(encoding="utf-8")

    assert "OrgMasterSelector" in page
    assert "LocationMasterSelector" in page
    for text in ["选择标准科室", "选择标准责任人", "选择标准学科", "选择标准空间位置"]:
        assert text in page
    for handler in ["handleDepartmentSelect", "handlePersonSelect", "handleDisciplineSelect", "handleLocationSelect"]:
        assert handler in page
    assert "department_source: masterSource(record)" in page
    assert "person_source: masterSource(record)" in page
    assert "discipline_source: masterSource(record)" in page
    assert "location: record.path || record.name" in page
    assert "location_source: masterSource(record)" in page
    assert "location_snapshot" in page
    assert "回查位置来源详情" in page
    assert "fetchLocationDetail" in page
    assert "fetchLocationDetail" in mdm_api
    assert "id: asset.mdm_location_id || asset.location || ''" in page
    assert "code: asset.location_code || asset.location || ''" in page
    assert "name: asset.location_name || asset.location || ''" in page
    assert "path: asset.location_path || asset.location || ''" in page
    assert "source: asset.location_source || DEFAULT_MASTER_SOURCE" in page
    assert "version: asset.location_version" in page
    assert "mdm_location_id?: string" in api
    assert "location_code?: string" in api
    assert "location_name?: string | null" in api
    assert "location_path?: string | null" in api
    assert "location_source?: string | null" in api
    assert "location_snapshot?: Record<string, unknown>" in api


def test_asset_detail_page_can_update_business_partner_refs() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")
    api = (ROOT / "frontend-admin" / "src" / "api" / "assets.ts").read_text(encoding="utf-8")

    assert "BusinessPartnerSelector" in page
    assert "PartnerRoleKey" in page
    assert "partnerRoleMeta" in page
    for text in ["生产厂家", "供应商", "品牌方", "注册证持有人", "维保商", "安装单位", "选择标准{meta.title}", "选择标准${partnerRoleMeta[partnerSelector].title}"]:
        assert text in page
    assert "handlePartnerSelect" in page
    for field in [
        "manufacturer_org_id",
        "manufacturer_org_code",
        "manufacturer_name",
        "supplier_org_id",
        "supplier_org_code",
        "supplier_name",
        "brand_owner_org_id",
        "brand_owner_org_code",
        "brand_owner_name",
        "registration_holder_org_id",
        "registration_holder_org_code",
        "registration_holder_name",
        "maintainer_org_id",
        "maintainer_org_code",
        "maintainer_name",
        "installer_org_id",
        "installer_org_code",
        "installer_name",
    ]:
        assert field in page
        assert f"{field}?: string" in api
    assert "org_source: masterSource(record)" in page
    assert "org_version: record.version" in page
    assert "source: asset.org_source || DEFAULT_MASTER_SOURCE" in page


def test_asset_detail_visible_master_reference_prefix_uses_humdg() -> None:
    page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")

    assert "UMDG-EQ-" in page
    assert "HMDM-EQ-" not in page


def test_frontend_defaults_master_source_to_humdg_for_user_visible_flows() -> None:
    detail_page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")
    create_page = (ROOT / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx").read_text(encoding="utf-8")
    plans_page = (ROOT / "frontend-admin" / "src" / "pages" / "pm" / "PmPlansPage.tsx").read_text(encoding="utf-8")
    tasks_page = (ROOT / "frontend-admin" / "src" / "pages" / "pm" / "PmTasksPage.tsx").read_text(encoding="utf-8")
    menu = (ROOT / "frontend-admin" / "src" / "navigation" / "hospitalMenu.ts").read_text(encoding="utf-8")

    for old_default in ["|| 'h-mdm'", "'h-mdm_selector'", "source=h-mdm"]:
        assert old_default not in detail_page
        assert old_default not in create_page
    assert "masterSourceOrDefault(selectedDepartment.source)" in plans_page
    assert "masterSourceOrDefault(selectedPerson.source)" in tasks_page
    assert "主数据来源设置" in menu
    assert "主数据服务配置" not in menu


def test_asset_schema_rejects_non_hmdm_registration_and_udi_refs() -> None:
    from pydantic import ValidationError

    from app.modules.asset.schemas import AssetCreate

    common = {
        "asset_code": "ASSET-REG-UDI-001",
        "asset_name": "pytest 设备",
        "mdm_category_id": "cat-1",
        "mdm_category_code": "07-04-01",
        "mdm_category_name": "病人监护设备",
        "mdm_source": "h-mdm",
    }
    with pytest.raises(ValidationError):
        AssetCreate(
            **common,
            registration_certificate_id="reg-local",
            registration_certificate_code="LOCAL-REG",
            registration_certificate_name="本地注册证",
            registration_certificate_source="local",
        )
    with pytest.raises(ValidationError):
        AssetCreate(
            **common,
            udi_id="udi-local",
            udi_code="LOCAL-UDI",
            udi_name="本地 UDI",
            udi_source="local",
        )
    with pytest.raises(ValidationError):
        AssetCreate(
            **common,
            brand_model_id="brand-model-local",
            brand_model_code="LOCAL-BM",
            brand_model_name="本地品牌型号",
            brand_model_source="local",
        )
    with pytest.raises(ValidationError):
        AssetCreate(
            **common,
            standard_equipment_id="standard-equipment-local",
            standard_equipment_code="LOCAL-STD",
            standard_equipment_name="本地标准设备",
            standard_equipment_source="local",
        )
    with pytest.raises(ValidationError):
        AssetCreate(
            **common,
            mdm_location_id="room-local",
            location_code="LOCAL-ROOM",
            location_name="本地房间",
            location_source="local",
        )


def test_asset_schema_accepts_humdg_standard_master_refs() -> None:
    from app.modules.asset.schemas import AssetCreate
    from app.modules.asset.service import _with_mdm_reference_defaults

    payload = AssetCreate(
        asset_code="ASSET-HUMDG-STD-001",
        asset_name="pytest H-UMDG 标准来源设备",
        mdm_category_id="cat-humdg",
        mdm_category_code="07-04-01",
        mdm_category_name="病人监护设备",
        mdm_category_version="H-UMDG-CAT-20260602",
        mdm_source="h-umdg",
        department_source="h-umdg",
        mdm_department_id="dept-1",
        department_code="DEPT-001",
        location_source="h-umdg",
        mdm_location_id="room-1",
        location_code="ROOM-001",
        location_name="DR 室",
        registration_certificate_source="h-umdg",
        registration_certificate_id="reg-1",
        registration_certificate_code="REG-001",
        registration_certificate_name="注册证 001",
        udi_source="h-umdg",
        udi_id="udi-1",
        udi_code="UDI-001",
        udi_name="UDI 001",
        brand_model_source="h-umdg",
        brand_model_id="bm-1",
        brand_model_code="BM-001",
        brand_model_name="品牌型号 001",
    )
    data = _with_mdm_reference_defaults(payload.model_dump())

    assert data["mdm_synced_at"] is not None
    assert data["department_synced_at"] is not None
    assert data["location_synced_at"] is not None
    assert data["classification_id"] == "cat-humdg"
    assert data["classification_match_status"] == "confirmed"
    assert data["mdm_source"] == "h-umdg"


def test_asset_service_default_standard_source_is_humdg() -> None:
    from app.modules.asset import service as asset_service

    assert asset_service.DEFAULT_STANDARD_MASTER_SOURCE == "h-umdg"
    assert asset_service._standard_master_source_or_default(None) == "h-umdg"
    assert asset_service._standard_master_source_or_default("local") == "h-umdg"
    assert asset_service._standard_master_source_or_default("h-mdm") == "h-umdg"
    assert asset_service._standard_master_source_or_default("h-umdg") == "h-umdg"
