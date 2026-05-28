from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


def test_hudmp_classification_match_bind_and_change_impact_minimal_loop(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not (
        pg_schema_has_table(engine, schema="asset", name="equipment_classification_impact")
        and pg_schema_has_table(engine, schema="integration", name="hmdm_classification_change")
    ):
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    match = client.post(
        "/api/v1/master-data/device-classification/match",
        headers=h,
        json={
            "deviceName": "飞利浦 IntelliVue MX800 病人监护仪",
            "brand": "Philips",
            "model": "IntelliVue MX800",
            "registrationName": "病人监护仪",
            "registrationCertificateNo": "",
            "managementClass": "",
            "department": "急诊科",
        },
    )
    assert match.status_code == 200, match.text
    candidates = match.json()["data"]["candidates"]
    assert len(candidates) >= 2
    picked = candidates[0]
    assert picked["classificationId"]
    assert picked["classificationCode"]

    asset_code = f"CLS-{uuid.uuid4().hex[:10]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": asset_code,
            "asset_name": "飞利浦 IntelliVue MX800 病人监护仪",
            "brand": "Philips",
            "model": "IntelliVue MX800",
            "department_name": "急诊科",
            "registration_no": "pytest-registration",
            "main_status": "ACTIVE",
        },
    )
    assert create.status_code == 200, create.text
    asset_id = create.json()["data"]["id"]

    bind = client.post(
        f"/api/v1/equipment/assets/{asset_id}/classification-bind",
        headers=h,
        json={
            "classificationId": picked["classificationId"],
            "classificationCode": picked["classificationCode"],
            "classificationName": picked["catalogItem"],
            "classificationVersionId": picked["versionId"],
            "managementClass": picked["managementClass"],
            "confirmReason": "根据设备名称、注册证名称和使用用途确认",
            "matchMethod": "manual_confirmed",
            "matchScore": picked["matchScore"],
        },
    )
    assert bind.status_code == 200, bind.text
    bound_asset = bind.json()["data"]["asset"]
    assert bound_asset["classification_id"] == picked["classificationId"]
    assert bound_asset["classification_code"] == picked["classificationCode"]
    assert bound_asset["classification_version_id"] == picked["versionId"]
    assert bound_asset["classification_match_status"] == "confirmed"

    change_id = f"CHG-{uuid.uuid4().hex[:12]}"
    change = client.post(
        "/api/v1/master-data/device-classification/changes/mock",
        headers=h,
        json={
            "changeId": change_id,
            "classificationId": picked["classificationId"],
            "classificationCode": picked["classificationCode"],
            "classificationName": picked["catalogItem"],
            "versionId": "HUDMP-2026-REV2",
            "changeType": "management_class_changed",
            "changeReason": "H-UMDG 模拟管理类别调整",
            "oldPayload": {"managementClass": picked["managementClass"]},
            "newPayload": {"managementClass": "III"},
        },
    )
    assert change.status_code == 200, change.text

    changes = client.get("/api/v1/master-data/device-classification/changes", headers=h)
    assert changes.status_code == 200
    assert any(x["changeId"] == change_id for x in changes.json()["data"]["changes"])

    sync = client.post("/api/v1/equipment/assets/classification-impacts/sync", headers=h, json={})
    assert sync.status_code == 200, sync.text
    assert sync.json()["data"]["created_count"] >= 1

    detail = client.get(f"/api/v1/assets/{asset_id}", headers=h)
    assert detail.status_code == 200
    detail_data = detail.json()["data"]
    assert detail_data["asset"]["classification_match_status"] == "need_review"
    assert detail_data["asset"]["classification_change_status"] == "pending"
    assert any(x["source_change_id"] == change_id for x in detail_data["classification_impacts"])

    need_review = client.get(
        "/api/v1/assets",
        headers=h,
        params={"classification_match_status": "need_review", "keyword": asset_code},
    )
    assert need_review.status_code == 200
    assert any(x["id"] == asset_id for x in need_review.json()["data"]["items"])


def test_hudmp_classification_impact_confirm_ignore_and_adjust_actions(
    client: TestClient,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    if not (
        pg_schema_has_table(engine, schema="asset", name="equipment_classification_impact")
        and pg_schema_has_table(engine, schema="integration", name="hmdm_classification_change")
    ):
        return
    h = skip_without_identity_jwt(pg_admin_headers)

    suffix = uuid.uuid4().hex[:10]
    asset_code = f"CLS-ACT-{suffix}"
    classification_id = f"DC-ACTION-{suffix}"
    classification_code = f"ACT-{suffix[:2]}-{suffix[2:4]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": asset_code,
            "asset_name": "分类复核动作测试设备",
            "department_name": "设备科",
            "main_status": "ACTIVE",
        },
    )
    assert create.status_code == 200, create.text
    asset_id = create.json()["data"]["id"]

    bind = client.post(
        f"/api/v1/equipment/assets/{asset_id}/classification-bind",
        headers=h,
        json={
            "classificationId": classification_id,
            "classificationCode": classification_code,
            "classificationName": "动作测试分类",
            "classificationVersionId": "HUDMP-ACTION-V1",
            "managementClass": "II",
            "confirmReason": "测试初始绑定",
            "matchMethod": "manual_confirmed",
            "matchScore": 90,
        },
    )
    assert bind.status_code == 200, bind.text

    high_change_id = f"ACT-HIGH-{suffix}"
    high_change = client.post(
        "/api/v1/master-data/device-classification/changes/mock",
        headers=h,
        json={
            "changeId": high_change_id,
            "classificationId": classification_id,
            "classificationCode": classification_code,
            "classificationName": "动作测试分类",
            "versionId": "HUDMP-ACTION-V2",
            "changeType": "management_class_changed",
            "changeReason": "测试管理类别变化",
        },
    )
    assert high_change.status_code == 200, high_change.text
    sync_high = client.post("/api/v1/equipment/assets/classification-impacts/sync", headers=h, json={})
    assert sync_high.status_code == 200, sync_high.text
    detail_high = client.get(f"/api/v1/assets/{asset_id}", headers=h)
    high_impact = next(x for x in detail_high.json()["data"]["classification_impacts"] if x["source_change_id"] == high_change_id)

    confirm = client.post(
        f"/api/v1/equipment/assets/classification-impacts/{high_impact['impact_id']}/confirm",
        headers=h,
        json={"handleReason": "人工确认当前分类仍适用"},
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["data"]["impact"]["status"] == "confirmed"
    assert confirm.json()["data"]["impact"]["handled_by"]

    low_change_id = f"ACT-LOW-{suffix}"
    low_change = client.post(
        "/api/v1/master-data/device-classification/changes/mock",
        headers=h,
        json={
            "changeId": low_change_id,
            "classificationId": classification_id,
            "classificationCode": classification_code,
            "classificationName": "动作测试分类",
            "versionId": "HUDMP-ACTION-V3",
            "changeType": "description_changed",
            "changeReason": "测试产品描述变化",
        },
    )
    assert low_change.status_code == 200, low_change.text
    sync_low = client.post("/api/v1/equipment/assets/classification-impacts/sync", headers=h, json={})
    assert sync_low.status_code == 200, sync_low.text
    detail_low = client.get(f"/api/v1/assets/{asset_id}", headers=h)
    low_impact = next(x for x in detail_low.json()["data"]["classification_impacts"] if x["source_change_id"] == low_change_id)
    ignore = client.post(
        f"/api/v1/equipment/assets/classification-impacts/{low_impact['impact_id']}/ignore",
        headers=h,
        json={"handleReason": "描述变化不影响该设备"},
    )
    assert ignore.status_code == 200, ignore.text
    assert ignore.json()["data"]["impact"]["status"] == "ignored"
    assert ignore.json()["data"]["impact"]["handled_by"]

    deprecated_change_id = f"ACT-DEP-{suffix}"
    deprecated_change = client.post(
        "/api/v1/master-data/device-classification/changes/mock",
        headers=h,
        json={
            "changeId": deprecated_change_id,
            "classificationId": classification_id,
            "classificationCode": classification_code,
            "classificationName": "动作测试分类",
            "versionId": "HUDMP-ACTION-V4",
            "changeType": "deprecated",
            "changeReason": "测试目录作废",
            "targetClassificationId": f"{classification_id}-NEW",
            "targetClassificationCode": f"{classification_code}-N",
        },
    )
    assert deprecated_change.status_code == 200, deprecated_change.text
    sync_deprecated = client.post("/api/v1/equipment/assets/classification-impacts/sync", headers=h, json={})
    assert sync_deprecated.status_code == 200, sync_deprecated.text
    detail_deprecated = client.get(f"/api/v1/assets/{asset_id}", headers=h)
    deprecated_impact = next(
        x for x in detail_deprecated.json()["data"]["classification_impacts"] if x["source_change_id"] == deprecated_change_id
    )
    blocked_ignore = client.post(
        f"/api/v1/equipment/assets/classification-impacts/{deprecated_impact['impact_id']}/ignore",
        headers=h,
        json={"handleReason": "尝试忽略作废目录"},
    )
    assert blocked_ignore.status_code == 409

    adjust = client.post(
        f"/api/v1/equipment/assets/classification-impacts/{deprecated_impact['impact_id']}/adjust",
        headers=h,
        json={
            "classificationId": f"{classification_id}-NEW",
            "classificationCode": f"{classification_code}-N",
            "classificationName": "动作测试新分类",
            "classificationVersionId": "HUDMP-ACTION-V4",
            "managementClass": "III",
            "confirmReason": "目录作废后人工调整到新分类",
            "handleReason": "目录作废强制重新映射",
            "matchMethod": "manual_adjusted",
            "matchScore": 88,
        },
    )
    assert adjust.status_code == 200, adjust.text
    assert adjust.json()["data"]["impact"]["status"] == "adjusted"
    assert adjust.json()["data"]["asset"]["classification_id"] == f"{classification_id}-NEW"
    assert adjust.json()["data"]["asset"]["classification_match_status"] == "remapped"
