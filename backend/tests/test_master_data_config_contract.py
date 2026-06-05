from app.core.config import Settings
from app.modules.system import asset_intake_extractor as aie_svc
from app.modules.system import master_data_source as mds_svc
from app.modules.system.schemas import MasterDataSourceTestResult


def test_master_data_default_mode_is_hybrid_for_humdg_closed_loop() -> None:
    settings = Settings()
    root = mds_svc.Path(__file__).resolve().parents[2]
    root_env = (root / ".env.example").read_text(encoding="utf-8")
    frontend_env = (root / "frontend-admin" / ".env.example").read_text(encoding="utf-8")
    app_meta = (root / "frontend-admin" / "src" / "config" / "appMeta.ts").read_text(encoding="utf-8")
    readme = (root / "README.md").read_text(encoding="utf-8")

    assert settings.normalized_master_data_mode() == "hybrid"
    assert "MASTER_DATA_MODE=hybrid" in root_env
    assert "MASTER_DATA_BASE_URL=http://127.0.0.1:8101" in root_env
    assert "VITE_MASTER_DATA_MODE=hybrid" in root_env
    assert "VITE_MASTER_DATA_MODE=hybrid" in frontend_env
    assert "return 'hybrid'" in app_meta
    assert "默认使用 `MASTER_DATA_MODE=hybrid`" in readme
    assert "显式使用本地模式" in readme


def test_master_data_service_mode_and_aliases_are_generic() -> None:
    settings = Settings(
        MASTER_DATA_MODE="remote",
        MASTER_DATA_PROVIDER="humdg",
        MASTER_DATA_BASE_URL="https://mdm.example.test",
        MASTER_DATA_API_KEY="secret",
        MASTER_DATA_TIMEOUT=7000,
        MASTER_DATA_CACHE_TTL=1800,
    )

    assert settings.normalized_master_data_mode() == "service"
    assert settings.master_data_provider == "humdg"
    assert settings.master_data_base_url() == "https://mdm.example.test"
    assert settings.master_data_token() == "secret"
    assert settings.master_data_timeout() == 7
    assert settings.effective_master_data_cache_ttl() == 1800


def test_local_mode_does_not_force_external_provider() -> None:
    settings = Settings(
        MASTER_DATA_MODE="local",
        MASTER_DATA_BASE_URL="https://mdm.example.test",
        MASTER_DATA_API_KEY="secret",
    )

    assert settings.normalized_master_data_mode() == "local"
    assert settings.master_data_base_url() == ""
    assert settings.master_data_token() == ""


def test_runtime_master_data_source_respects_explicit_local_mode(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MASTER_DATA_MODE", "local")
    monkeypatch.setenv("MASTER_DATA_BASE_URL", "http://127.0.0.1:8101")
    monkeypatch.setenv("MASTER_DATA_API_KEY", "hudmp-equipment-os-dev-20260525")
    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")
    mds_svc.CONFIG_PATH.write_text(
        (
            '{"source_name":"stale","provider":"h-umdg","mode":"hybrid",'
            '"base_url":"http://127.0.0.1:8101","auth_type":"api_key",'
            '"api_key_encrypted":"'
            + mds_svc._legacy_crypt("stale-secret")
            + '"}'
        ),
        encoding="utf-8",
    )
    mds_svc.get_settings.cache_clear()

    try:
        source = mds_svc.public_source()
        runtime = mds_svc.get_runtime_source()
    finally:
        mds_svc.get_settings.cache_clear()

    assert source["mode"] == "local"
    assert source["base_url"] == ""
    assert source["api_key_configured"] is False
    assert source["api_key_masked"] is None
    assert runtime.api_key == ""


def test_master_data_source_contract_lists_required_closed_loop_objects() -> None:
    object_codes = {item["object_code"] for item in mds_svc.REQUIRED_OBJECTS}
    capability_codes = {item["capability_code"] for item in mds_svc.REQUIRED_CAPABILITIES}

    assert {
        "health",
        "campus",
        "location",
        "department",
        "person",
        "discipline",
        "device_category",
        "equipment_generic_name",
        "business_partner",
        "brand_model",
        "standard_equipment",
        "registration_certificate",
        "udi",
    }.issubset(object_codes)
    assert all(str(item["endpoint"]).startswith("/api/v1/master-data/") for item in mds_svc.REQUIRED_OBJECTS)
    assert any(item["endpoint"] == "/api/v1/master-data/equipment/standard-names?page=1&pageSize=5" for item in mds_svc.REQUIRED_OBJECTS)
    assert {
        "equipment_master_match",
        "business_partner_match",
        "registration_udi_match",
        "reference_detail_lookup",
        "supplement_requests",
    }.issubset(capability_codes)
    assert any("/api/v1/mdm/match/udi" in item["consumer_endpoint"] for item in mds_svc.REQUIRED_CAPABILITIES)
    assert any("/api/v1/assets/intake/tasks/{task_id}/match-mdm" == item["consumer_endpoint"] for item in mds_svc.REQUIRED_CAPABILITIES)
    assert any("/api/v1/master-data/locations/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/departments/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/persons/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/disciplines/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/device-classification/catalog/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/equipment/standard-names/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/business-partners/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/equipment-brand-models/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/standard-equipment-library/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/registration-certificates/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)
    assert any("/api/v1/master-data/udis/{id_or_code}" == item.get("detail_endpoint") for item in mds_svc.REQUIRED_OBJECTS)


def test_master_data_source_public_payload_never_exposes_raw_api_key(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")

    saved = mds_svc.update_source(
        {
            "mode": "hybrid",
            "base_url": "http://127.0.0.1:8101",
            "auth_type": "api_key",
            "api_key": "hudmp-equipment-os-dev-20260525",
        }
    )

    assert saved["api_key_configured"] is True
    assert saved["api_key_masked"] == "hudm****0525"
    assert "hudmp-equipment-os-dev-20260525" not in str(saved)

    stored = mds_svc.CONFIG_PATH.read_text(encoding="utf-8")
    assert "hudmp-equipment-os-dev-20260525" not in stored
    assert '"api_key_encrypted": "fernet:' in stored


def test_master_data_source_can_read_legacy_runtime_key(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")
    legacy_key = mds_svc._legacy_crypt("legacy-secret")
    mds_svc.CONFIG_PATH.write_text(
        (
            '{"source_name":"legacy","provider":"h-umdg","mode":"hybrid",'
            '"base_url":"http://127.0.0.1:8101","auth_type":"api_key",'
            f'"api_key_encrypted":"{legacy_key}"'
            "}"
        ),
        encoding="utf-8",
    )

    assert mds_svc.get_runtime_source().api_key == "legacy-secret"


def test_master_data_source_page_exposes_user_operable_source_settings() -> None:
    page = (mds_svc.Path(__file__).resolve().parents[2] / "frontend-admin" / "src" / "pages" / "MasterDataSourceConfigPage.tsx").read_text(encoding="utf-8")
    api = (mds_svc.Path(__file__).resolve().parents[2] / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")
    router = (mds_svc.Path(__file__).resolve().parents[2] / "backend" / "app" / "modules" / "system" / "router.py").read_text(encoding="utf-8")

    assert "主数据来源设置" in page
    assert "refreshMasterDataSourceCache" in page
    assert "刷新缓存" in page
    assert "refreshResult" in page
    assert "Object.entries(refreshResult.refreshed" in page
    assert "主数据缓存刷新完成" in page
    assert "conflict_strategy" in page
    assert "标准主数据优先" in page
    assert "API Key" in page
    assert "导出对接包" in page
    assert "对接能力清单" in page
    assert "设备主数据自动匹配" in page
    assert "档案引用详情回查" in page
    assert "位置、通用名称、品牌型号、标准设备、注册证、UDI 按 id/code 回查详情" in page
    assert "详情回查" in page
    assert "detail_probe" in page
    assert "detail_endpoint" in api
    assert "detail_probe" in api
    assert "/api/v1/mdm/match/udi" in page
    assert "/api/v1/hmdm/*-requests" in page
    assert "/api/v1/system/master-data-source/cache/refresh" in api
    assert "mds_svc.refresh_source_cache" in router
    assert "refresh_hmdm_cache" not in router


def test_asset_intake_extractor_runtime_config_never_exposes_raw_api_key(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")

    saved = aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "http://127.0.0.1:8202/api/v1/asset-intake/extract",
            "auth_type": "bearer",
            "api_key": "asset-intake-secret",
            "provider": "院内图片识别服务",
            "model": "vision-ocr-medical-device-v1",
            "timeout_ms": 30000,
        }
    )
    runtime = aie_svc.get_runtime_extractor()

    assert saved["enabled"] is True
    assert saved["mode"] == "vision_llm"
    assert saved["api_key_configured"] is True
    assert saved["api_key_masked"] == "asse****cret"
    assert runtime.api_key == "asset-intake-secret"
    stored = aie_svc.CONFIG_PATH.read_text(encoding="utf-8")
    assert "asset-intake-secret" not in stored
    assert '"api_key_encrypted": "fernet:' in stored


def test_asset_intake_extractor_image_test_reuses_real_adapter(monkeypatch, tmp_path) -> None:
    import asyncio

    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")
    aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "http://127.0.0.1:8202/api/v1/asset-intake/extract",
            "auth_type": "bearer",
            "api_key": "asset-intake-secret",
            "provider": "qwen-vl",
            "model": "qwen-vl-max",
            "timeout_ms": 30000,
        }
    )

    async def fake_extract(file_id: str, file_name: str, mime_type: str | None, content: bytes) -> dict:
        assert file_id == "system-config-test-image"
        assert file_name == "nameplate.png"
        assert mime_type == "image/png"
        assert content == b"image-bytes"
        return {
            "provider": {"provider": "qwen-vl", "model": "qwen-vl-max", "message": "识别完成"},
            "fields": {
                "basic": {
                    "device_name": {"value": "监护仪", "confidence": 92, "basis": "铭牌"},
                    "brand": {"value": "ACME", "confidence": 88, "basis": "铭牌"},
                }
            },
            "components": [{"name": "电源线"}],
            "confidence": 90,
        }

    monkeypatch.setattr("app.modules.asset.intake_extractor.extract_asset_intake_document_bytes", fake_extract)

    data = asyncio.run(aie_svc.test_image("nameplate.png", "image/png", b"image-bytes"))

    assert data["connected"] is True
    assert data["extracted"] is True
    assert data["field_value_count"] == 2
    assert data["provider"]["provider"] == "qwen-vl"
    assert data["fields"]["basic"]["device_name"]["value"] == "监护仪"
    assert data["components"][0]["name"] == "电源线"


def test_asset_intake_extractor_supports_openai_compatible_vision(monkeypatch, tmp_path) -> None:
    import asyncio

    from app.modules.asset import intake_extractor

    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")
    aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            "auth_type": "bearer",
            "api_key": "dashscope-key",
            "provider": "qwen-vl",
            "model": "qwen-vl-max",
            "timeout_ms": 30000,
        }
    )
    captured: dict = {}

    class FakeResponse:
        status_code = 200
        is_success = True
        text = "{}"

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"fields":{"basic":{"device_name":{"value":"输液泵","confidence":91,"basis":"铭牌"}}},"confidence":91}'
                        }
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            captured["headers"] = kwargs.get("headers")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url: str, json: dict):
            captured["url"] = url
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(intake_extractor.httpx, "AsyncClient", FakeClient)

    data = asyncio.run(
        intake_extractor.extract_asset_intake_document_bytes(
            "file-1",
            "nameplate.png",
            "image/png",
            b"image-bytes",
        )
    )

    assert captured["url"].endswith("/chat/completions")
    assert captured["payload"]["model"] == "qwen-vl-max"
    assert captured["payload"]["messages"][0]["content"][2]["type"] == "image_url"
    assert captured["payload"]["messages"][0]["content"][2]["image_url"]["url"].startswith("data:image/png;base64,")
    assert captured["headers"]["Authorization"] == "Bearer dashscope-key"
    assert data["provider"]["provider"] == "qwen-vl"
    assert data["provider"]["model"] == "qwen-vl-max"
    assert data["fields"]["basic"]["device_name"]["value"] == "输液泵"


def test_openai_compatible_base_url_appends_chat_completions(monkeypatch, tmp_path) -> None:
    import asyncio

    from app.modules.asset import intake_extractor

    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")
    aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "auth_type": "bearer",
            "api_key": "dashscope-key",
            "provider": "qwen-vl",
            "model": "qwen-vl-max",
            "timeout_ms": 30000,
        }
    )
    cfg = aie_svc.get_runtime_extractor()
    assert aie_svc.openai_compatible_endpoint_url(cfg) == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

    captured: dict = {}

    class FakeResponse:
        status_code = 200

        @property
        def headers(self) -> dict:
            return {"content-type": "application/json"}

        @property
        def text(self) -> str:
            return "{}"

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            if captured.get("kind") == "health":
                return {"choices": [{"message": {"content": "OK"}}]}
            return {"choices": [{"message": {"content": '{"fields":{"basic":{"device_name":{"value":"监护仪"}}}}'}}]}

        @property
        def is_success(self) -> bool:
            return True

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url: str, json: dict):
            captured.setdefault("urls", []).append(url)
            captured["kind"] = "health" if isinstance(json.get("messages", [{}])[0].get("content"), str) else "image"
            return FakeResponse()

    monkeypatch.setattr(aie_svc.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(intake_extractor.httpx, "AsyncClient", FakeClient)

    health = asyncio.run(aie_svc.test_config())
    data = asyncio.run(intake_extractor.extract_asset_intake_document_bytes("file-1", "nameplate.png", "image/png", b"img"))

    assert health["connected"] is True
    assert health["effective_endpoint_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert captured["urls"] == [
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    ]
    assert data["fields"]["basic"]["device_name"]["value"] == "监护仪"


def test_dashscope_placeholder_model_falls_back_to_qwen_vl(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")
    aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "auth_type": "bearer",
            "api_key": "dashscope-key",
            "provider": "院内图片识别服务",
            "model": "vision-ocr-medical-device-v1",
            "timeout_ms": 30000,
        }
    )
    cfg = aie_svc.get_runtime_extractor()

    assert aie_svc.openai_compatible_model(cfg) == "qwen-vl-max"
    diagnostics = aie_svc.endpoint_diagnostics(cfg, 404)
    assert diagnostics["model"] == "qwen-vl-max"
    assert any("示例占位" in item for item in diagnostics["hints"])


def test_openai_compatible_test_reports_http_diagnostics(monkeypatch, tmp_path) -> None:
    import asyncio

    monkeypatch.setattr(aie_svc, "CONFIG_PATH", tmp_path / "asset_intake_extractor.json")
    aie_svc.update_config(
        {
            "enabled": True,
            "mode": "vision_llm",
            "endpoint_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "auth_type": "bearer",
            "api_key": "dashscope-key",
            "provider": "qwen-vl",
            "model": "qwen-vl-max",
            "timeout_ms": 30000,
        }
    )

    class FakeResponse:
        status_code = 404
        text = '{"error":{"code":"NotFound","message":"model or endpoint not found"}}'
        is_success = False
        headers = {"content-type": "application/json"}

        def json(self) -> dict:
            return {"error": {"code": "NotFound", "message": "model or endpoint not found"}}

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url: str, json: dict):
            return FakeResponse()

    monkeypatch.setattr(aie_svc.httpx, "AsyncClient", FakeClient)

    data = asyncio.run(aie_svc.test_config())

    assert data["connected"] is False
    assert data["status_code"] == 404
    assert data["effective_endpoint_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert "NotFound" in data["message"]
    assert data["diagnostics"]["raw_body"]["error"]["message"] == "model or endpoint not found"
    assert any("地域" in item for item in data["diagnostics"]["hints"])


def test_asset_intake_extractor_page_and_menu_are_user_operable() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    page = (root / "frontend-admin" / "src" / "pages" / "AssetIntakeExtractorConfigPage.tsx").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")
    app = (root / "frontend-admin" / "src" / "App.tsx").read_text(encoding="utf-8")
    menu = (root / "frontend-admin" / "src" / "navigation" / "hospitalMenu.ts").read_text(encoding="utf-8")
    router = (root / "backend" / "app" / "modules" / "system" / "router.py").read_text(encoding="utf-8")

    assert "图片识别服务配置" in page
    assert "保存配置" in page
    assert "连通测试" in page
    assert "图片识别测试" in page
    assert "Upload.Dragger" in page
    assert "fetchAssetIntakeExtractorConfig" in page
    assert "updateAssetIntakeExtractorConfig" in page
    assert "testAssetIntakeExtractorConfig" in page
    assert "testAssetIntakeExtractorImage" in page
    assert "field_value_count" in page
    assert "effective_endpoint_url" in page
    assert "DiagnosticBlock" in page
    assert "raw_body" in page
    assert "compatible-mode/v1" in page
    assert "qwen-vl-max" in page
    assert "/api/v1/system/asset-intake-extractor" in api
    assert "/api/v1/system/asset-intake-extractor/test" in api
    assert "/api/v1/system/asset-intake-extractor/test-image" in api
    assert "AssetIntakeExtractorConfigPage" in app
    assert "assetIntakeExtractorConfig" in app
    assert "/system/ai/asset-intake-extractor" in menu
    assert "图片识别服务" in menu
    assert "get_asset_intake_extractor" in router
    assert "patch_asset_intake_extractor" in router
    assert "test_asset_intake_extractor" in router
    assert "test_asset_intake_extractor_image" in router


def test_asset_archive_exposes_generic_name_master_selector() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    mdm_api = (root / "frontend-admin" / "src" / "api" / "mdm.ts").read_text(encoding="utf-8")
    selector = (root / "frontend-admin" / "src" / "components" / "EquipmentMasterSelector.tsx").read_text(encoding="utf-8")
    create_page = (root / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx").read_text(encoding="utf-8")
    detail_page = (root / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx").read_text(encoding="utf-8")

    assert "EquipmentGenericNameMaster" in mdm_api
    assert "searchEquipmentGenericNames" in mdm_api
    assert "/api/v1/mdm/equipment-generic-names" in mdm_api
    assert "kind: 'generic-name'" in selector
    assert "选择标准通用名称主数据" in selector
    assert "mdmGenericName" in create_page
    assert "选择标准通用名称" in create_page
    assert "genericNameSelectorOpen" in detail_page
    assert "handleGenericNameSelect" in detail_page
    assert "hmdm_equipment_name_code" in detail_page
    assert "选择标准通用名称" in detail_page


def test_mdm_adapter_exposes_reference_detail_lookup_endpoints() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    router = (root / "backend" / "app" / "modules" / "mdm" / "router.py").read_text(encoding="utf-8")
    service = (root / "backend" / "app" / "modules" / "mdm" / "service.py").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "mdm.ts").read_text(encoding="utf-8")

    for route in [
        '@router.get("/locations/{location_id}"',
        '@router.get("/departments/{department_id}"',
        '@router.get("/persons/{person_id}"',
        '@router.get("/disciplines/{discipline_id}"',
        '@router.get("/device-categories/{category_id}"',
        '@router.get("/business-partners/{partner_id}"',
        '@router.get("/equipment-generic-names/{record_id}"',
        '@router.get("/registration-certificates/{certificate_id}"',
        '@router.get("/udis/{udi_id}"',
        '@router.get("/equipment-brand-models/{record_id}"',
        '@router.get("/standard-equipment-library/{record_id}"',
    ]:
        assert route in router

    for source_call in [
        '"/api/v1/master-data/locations/{location_id}"',
        '"/api/v1/master-data/departments/{department_id}"',
        '"/api/v1/master-data/persons/{person_id}"',
        '"/api/v1/master-data/disciplines/{discipline_id}"',
        '"/api/v1/master-data/device-classification/catalog/{category_id}"',
        '"/api/v1/master-data/business-partners/{partner_id}"',
        '"/api/v1/master-data/equipment/standard-names"',
        '"/api/v1/master-data/registration-certificates"',
        '"/api/v1/master-data/udis"',
        '"/api/v1/master-data/equipment-brand-models"',
        '"/api/v1/master-data/standard-equipment-library"',
    ]:
        assert source_call in service

    for frontend_api in [
        "fetchLocationDetail",
        "fetchEquipmentGenericNameDetail",
        "fetchRegistrationCertificateDetail",
        "fetchUdiDetail",
        "fetchBrandModelDetail",
        "fetchStandardEquipmentDetail",
    ]:
        assert frontend_api in api


def test_location_selector_uses_generic_master_data_source_wording() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    selector = (root / "frontend-admin" / "src" / "components" / "LocationMasterSelector.tsx").read_text(encoding="utf-8")

    assert "空间位置来自标准主数据服务" in selector
    assert "空间位置来自 H-UMDG" not in selector


def test_frontend_selectors_accept_standard_master_source_aliases() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    util = (root / "frontend-admin" / "src" / "utils" / "masterSource.ts").read_text(encoding="utf-8")
    selector_files = [
        root / "frontend-admin" / "src" / "components" / "DeviceCategorySelector.tsx",
        root / "frontend-admin" / "src" / "components" / "OrgMasterSelector.tsx",
        root / "frontend-admin" / "src" / "components" / "LocationMasterSelector.tsx",
        root / "frontend-admin" / "src" / "components" / "EquipmentMasterSelector.tsx",
        root / "frontend-admin" / "src" / "components" / "RegistrationUdiSelector.tsx",
        root / "frontend-admin" / "src" / "components" / "BusinessPartnerSelector.tsx",
        root / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx",
        root / "frontend-admin" / "src" / "pages" / "AssetDetailPage.tsx",
    ]

    assert "'h-mdm'" in util
    assert "'h-umdg'" in util
    assert "isStandardMasterSource" in util
    for path in selector_files:
        text = path.read_text(encoding="utf-8")
        assert "isStandardMasterSource" in text
    assert "source 非 h-mdm" not in (root / "frontend-admin" / "src" / "pages" / "AssetCreatePage.tsx").read_text(encoding="utf-8")


def test_hmdm_fallback_versions_use_current_humdg_prefix() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    service = (root / "backend" / "app" / "modules" / "hmdm" / "service.py").read_text(encoding="utf-8")

    assert 'FALLBACK_VERSION_ID = "H-UMDG-2026-CURRENT"' in service
    assert "HUDMP-2026-CURRENT" not in service


def test_business_partner_selector_submits_real_master_data_request() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    selector = (root / "frontend-admin" / "src" / "components" / "BusinessPartnerSelector.tsx").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")

    assert "createManufacturerVendorRequest" in selector
    assert "提交往来单位主数据补充/修正申请" in selector
    assert "submitRequest" in selector
    assert "占位入口" not in selector
    assert "/api/v1/hmdm/manufacturer-vendor-requests" in api


def test_equipment_generic_name_selector_submits_real_master_data_request() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    selector = (root / "frontend-admin" / "src" / "components" / "EquipmentMasterSelector.tsx").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")

    assert "createEquipmentNameRequest" in selector
    assert "提交通用名称主数据补充/修正申请" in selector
    assert "submitRequest" in selector
    assert "提交通用名称补充申请" in selector
    assert "/api/v1/hmdm/equipment-standard-name-requests" in api


def test_device_category_selector_submits_real_master_data_request() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    selector = (root / "frontend-admin" / "src" / "components" / "DeviceCategorySelector.tsx").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")
    router = (root / "backend" / "app" / "modules" / "hmdm" / "router.py").read_text(encoding="utf-8")
    migration = (root / "backend" / "alembic" / "versions" / "e032_device_classification_request.py").read_text(encoding="utf-8")

    assert "createDeviceClassificationRequest" in selector
    assert "提交医疗器械分类目录补充/修正申请" in selector
    assert "submitRequest" in selector
    assert "提交主数据补充申请流程将在主数据服务申请中心接入" not in selector
    assert "/api/v1/hmdm/device-classification-requests" in api
    assert '@router.post("/device-classification-requests"' in router
    assert "device_classification_request" in migration


def test_org_master_selector_submits_real_master_data_request() -> None:
    root = mds_svc.Path(__file__).resolve().parents[2]
    selector = (root / "frontend-admin" / "src" / "components" / "OrgMasterSelector.tsx").read_text(encoding="utf-8")
    api = (root / "frontend-admin" / "src" / "api" / "hmdm.ts").read_text(encoding="utf-8")
    router = (root / "backend" / "app" / "modules" / "hmdm" / "router.py").read_text(encoding="utf-8")
    migration = (root / "backend" / "alembic" / "versions" / "e033_organization_master_request.py").read_text(encoding="utf-8")

    assert "createOrganizationMasterRequest" in selector
    assert "提交科室主数据补充/修正申请" in selector
    assert "提交人员主数据补充/修正申请" in selector
    assert "提交学科主数据补充/修正申请" in selector
    assert "submitRequest" in selector
    assert "提交主数据补充/修正申请流程将在主数据服务申请中心接入" not in selector
    assert "/api/v1/hmdm/organization-master-requests" in api
    assert '@router.post("/organization-master-requests"' in router
    assert "organization_master_request" in migration


def test_master_data_contract_package_includes_live_test_status(monkeypatch, tmp_path) -> None:
    import asyncio

    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")

    async def fake_test_source() -> dict:
        return {
            "connected": True,
            "source_name": "H-UMDG",
            "base_url": "http://127.0.0.1:8101",
            "tested_at": "2026-06-02T00:00:00+00:00",
            "items": [{"object_code": "health", "ok": True, "sample_count": 1}],
        }

    monkeypatch.setattr(mds_svc, "test_source", fake_test_source)
    package = asyncio.run(mds_svc.contract_package())

    assert package["test_status"]["connected"] is True
    assert package["test_status"]["items"][0]["object_code"] == "health"
    assert any(item["object_code"] == "equipment_generic_name" for item in package["required_objects"])
    assert any(item["capability_code"] == "equipment_master_match" for item in package["required_capabilities"])
    assert any(item["capability_code"] == "registration_udi_match" for item in package["required_capabilities"])
    assert any(item["capability_code"] == "reference_detail_lookup" for item in package["required_capabilities"])
    assert package["response_shape"]["detail"]["id"] == "string"


def test_master_data_source_test_probes_detail_endpoint(monkeypatch, tmp_path) -> None:
    import asyncio

    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")
    calls: list[str] = []

    class FakeResponse:
        def __init__(self, endpoint: str) -> None:
            self.status_code = 200
            self.content = b"{}"
            self.text = "{}"
            self.endpoint = endpoint

        def json(self) -> dict:
            if self.endpoint.endswith("/locations?page=1&pageSize=5"):
                return {"data": {"records": [{"id": "room-1", "code": "ROOM-001", "name": "DR 室"}], "total": 1}}
            return {"data": {"id": "room-1", "code": "ROOM-001", "name": "DR 室"}}

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def get(self, url: str):
            endpoint = url.replace("http://127.0.0.1:8101", "")
            calls.append(endpoint)
            return FakeResponse(endpoint)

    monkeypatch.setattr(mds_svc.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(
        mds_svc,
        "REQUIRED_OBJECTS",
        [
            {
                "object_code": "location",
                "object_name": "空间位置",
                "endpoint": "/api/v1/master-data/locations?page=1&pageSize=5",
                "detail_endpoint": "/api/v1/master-data/locations/{id_or_code}",
                "required_fields": [],
                "sample": {},
            }
        ],
    )

    data = asyncio.run(mds_svc.test_source())

    assert data["items"][0]["detail_probe"]["ok"] is True
    assert data["items"][0]["detail_probe"]["endpoint"] == "/api/v1/master-data/locations/room-1"
    assert "/api/v1/master-data/locations/room-1" in calls


def test_master_data_source_test_response_model_preserves_detail_probe() -> None:
    payload = {
        "connected": True,
        "source_name": "H-UMDG",
        "base_url": "http://127.0.0.1:8101",
        "tested_at": "2026-06-02T00:00:00+00:00",
        "items": [
            {
                "object_code": "location",
                "object_name": "空间位置",
                "endpoint": "/api/v1/master-data/locations?page=1&pageSize=5",
                "ok": True,
                "sample_count": 1,
                "detail_endpoint": "/api/v1/master-data/locations/{id_or_code}",
                "detail_probe": {
                    "endpoint": "/api/v1/master-data/locations/room-1",
                    "ok": True,
                    "status_code": 200,
                    "message": "可回查",
                },
            }
        ],
    }

    data = MasterDataSourceTestResult.model_validate(payload).model_dump(mode="json")

    assert data["items"][0]["detail_endpoint"] == "/api/v1/master-data/locations/{id_or_code}"
    assert data["items"][0]["detail_probe"]["endpoint"] == "/api/v1/master-data/locations/room-1"
    assert data["items"][0]["detail_probe"]["ok"] is True


def test_master_data_source_refresh_uses_required_objects(monkeypatch, tmp_path) -> None:
    import asyncio

    monkeypatch.setattr(mds_svc, "CONFIG_PATH", tmp_path / "master_data_source.json")

    async def fake_test_source() -> dict:
        return {
            "connected": True,
            "source_name": "H-UMDG",
            "base_url": "http://127.0.0.1:8101",
            "items": [
                {"object_code": "health", "object_name": "健康", "endpoint": "/health", "ok": True, "sample_count": 1},
                {"object_code": "udi", "object_name": "UDI", "endpoint": "/udis", "ok": True, "sample_count": 3},
            ],
        }

    monkeypatch.setattr(mds_svc, "test_source", fake_test_source)
    data = asyncio.run(mds_svc.refresh_source_cache())

    assert data["connected"] is True
    assert data["refreshed"] == {"health": 1, "udi": 3}
    assert data["failed"] == []
    assert data["cache_status"]["ttl_seconds"] == 3600
