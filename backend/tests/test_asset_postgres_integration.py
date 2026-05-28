"""设备台账集成测试：需 PostgreSQL + 已执行 Alembic 迁移（见 CI）。

设计引用：docs/06_接口设计/01 §一 · docs/03_数据库设计/04 §二
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


@pytest.fixture
def require_postgres_db() -> None:
    """模块级跳过：SQLite 冒烟阶段不执行真实 PG 台账。"""
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("集成测试需在 PostgreSQL + Alembic 迁移后的环境运行")
    if not pg_schema_has_table(engine, schema="asset", name="asset"):
        pytest.skip("需 PostgreSQL 已执行 alembic（asset.asset · e002 等）")


def test_asset_roundtrip_crud_scan(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    code = f"T-{uuid.uuid4().hex[:10]}"
    create = client.post(
        "/api/v1/assets",
        headers=h,
        json={
            "asset_code": code,
            "asset_name": "pytest 呼吸机",
            "main_status": "ACTIVE",
            "risk_level": "MEDIUM",
        },
    )
    assert create.status_code == 200, create.text
    aid = create.json()["data"]["id"]

    lst = client.get("/api/v1/assets", params={"keyword": "pytest"}, headers=h)
    assert lst.status_code == 200
    assert any(x["asset_code"] == code for x in lst.json()["data"]["items"])

    detail = client.get(f"/api/v1/assets/{aid}", headers=h)
    assert detail.status_code == 200
    assert detail.json()["data"]["asset"]["asset_code"] == code

    qr = client.get(f"/api/v1/assets/{aid}/qrcode", headers=h)
    assert qr.status_code == 200
    token = qr.json()["data"]["qr_token"]

    label = client.get(f"/api/v1/assets/{aid}/print-label", headers=h)
    assert label.status_code == 200
    label_data = label.json()["data"]
    assert label_data["asset"]["asset_code"] == code
    assert label_data["sdk"]["service_ws_url"] == "ws://127.0.0.1:37989"
    assert label_data["template"]["template_code"] == "ASSET_QR_50X30_V1"
    assert label_data["template"]["paper_type_code"] == "GAP"
    assert label_data["print_data"]["InitDrawingBoardParam"]["width"] == 50.0
    assert any(x["type"] == "qrCode" for x in label_data["print_data"]["elements"])

    templates = client.get("/api/v1/assets/label-templates", headers=h)
    assert templates.status_code == 200
    assert templates.json()["data"]["default_template_code"] == "ASSET_QR_50X30_V1"

    detailed_label = client.get(
        f"/api/v1/assets/{aid}/print-label",
        params={"template_code": "ASSET_QR_60X40_DETAIL"},
        headers=h,
    )
    assert detailed_label.status_code == 200
    detailed_data = detailed_label.json()["data"]
    assert detailed_data["template"]["template_code"] == "ASSET_QR_60X40_DETAIL"
    assert detailed_data["template"]["label_width_mm"] == 60.0
    assert detailed_data["print_data"]["InitDrawingBoardParam"]["height"] == 40.0

    single_feed_label = client.get(
        f"/api/v1/assets/{aid}/print-label",
        params={"template_code": "ASSET_QR_60X40_SINGLE_FEED"},
        headers=h,
    )
    assert single_feed_label.status_code == 200
    single_feed_data = single_feed_label.json()["data"]
    assert single_feed_data["template"]["template_code"] == "ASSET_QR_60X40_SINGLE_FEED"
    assert single_feed_data["template"]["label_height_mm"] == 20.0
    assert single_feed_data["print_data"]["InitDrawingBoardParam"]["height"] == 20.0

    strip_label = client.get(
        f"/api/v1/assets/{aid}/print-label",
        params={"template_code": "ASSET_QR_50X20_STRIP"},
        headers=h,
    )
    assert strip_label.status_code == 200
    strip_data = strip_label.json()["data"]
    assert strip_data["template"]["label_height_mm"] == 20.0
    assert strip_data["print_data"]["InitDrawingBoardParam"]["height"] == 20.0

    transfer_label = client.get(
        f"/api/v1/assets/{aid}/print-label",
        params={"template_code": "ASSET_QR_50X25_TRANSFER"},
        headers=h,
    )
    assert transfer_label.status_code == 200
    transfer_data = transfer_label.json()["data"]
    assert transfer_data["template"]["label_width_mm"] == 50.0
    assert transfer_data["template"]["label_height_mm"] == 25.0
    assert transfer_data["template"]["print_mode"] == 2
    assert transfer_data["template"]["print_density"] == 8
    assert transfer_data["print_data"]["InitDrawingBoardParam"]["height"] == 25.0

    scan = client.post("/api/v1/scan/asset", json={"qr_token": token}, headers=h)
    assert scan.status_code == 200
    assert scan.json()["data"]["asset_code"] == code

    put = client.put(
        f"/api/v1/assets/{aid}",
        headers=h,
        json={"asset_name": "pytest 呼吸机·已更新"},
    )
    assert put.status_code == 200
    assert put.json()["data"]["asset_name"] == "pytest 呼吸机·已更新"
