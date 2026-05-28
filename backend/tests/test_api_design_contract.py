"""
与《API接口设计》对齐的 HTTP 契约烟测。

设计文档路径（单一引用源，便于全文检索）：
docs/06_接口设计/01_API接口设计.md

说明：
- 本节断言已实现路径的稳定行为（前缀、`{code,message,data}`）。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pg_jwt_helpers import skip_without_identity_jwt


def assert_api_envelope(body: dict[str, object]) -> None:
    assert set(body.keys()) >= {"code", "message", "data"}
    assert body["code"] == 0
    assert isinstance(body["message"], str)


@pytest.mark.parametrize(
    ("method", "path", "doc_ref"),
    [
        ("GET", "/api/v1/suppliers", "早期 /suppliers 汇总占位（正式门户前缀 /supplier-portal）"),
        ("GET", "/api/v1/finance", "财务分域占位（§五 建议使用 /finance/invoices 等资源路径）"),
        ("GET", "/api/v1/workflows", "工作流根路径（§八 已实现 /workflows/start 等）"),
        ("GET", "/api/v1/ai", "AI 网关根路径（§六 已实现 /ai/tasks）"),
        ("GET", "/api/v1/knowledge", "知识库模块根路径（§七 已实现 /knowledge/documents）"),
        ("GET", "/api/v1/mdm", "MDM 模块根路径（e006 category-entries）"),
        ("GET", "/api/v1/pm", "PM 模块根路径（docs/06 · 十、e017_pm_core）"),
        ("GET", "/api/v1/metrology", "计量与合规模块根路径（docs/06 · 十一、e018_metrology_core）"),
    ],
)
def test_placeholder_routes_match_doc_envelope(
    client: TestClient,
    method: str,
    path: str,
    doc_ref: str,
) -> None:
    """每个参数行为一条「文档可追溯」契约：占位亦不得破坏统一信封。"""
    res = client.request(method, path)
    assert res.status_code == 200, f"{doc_ref} -> {path}"
    body = res.json()
    assert_api_envelope(body)
    assert isinstance(body["data"], dict), doc_ref


def test_asset_list_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§一·1：PostgreSQL 已迁移且无令牌时返回 401；带 JWT 时分页信封合法或缺表 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/assets")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/assets", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert isinstance(data, dict)
    assert "items" in data and "total" in data and "page" in data and "page_size" in data


def test_repair_center_root_navigation_contains_paths(client: TestClient) -> None:
    """统一报修中心根路径：报修工单是结果，入口能力从 repair-center 发现。"""
    res = client.get("/api/v1/repair-center")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    data = body["data"]
    assert data.get("module") == "repair-center"
    assert "repair_order" in data.get("positioning", "")
    paths = data.get("paths")
    assert isinstance(paths, dict)
    assert paths.get("messages") == "/api/v1/repair-center/messages"
    assert paths.get("repair_orders") == "/api/v1/repairs"
    entries = data.get("supported_entries")
    assert isinstance(entries, list)
    assert "设备二维码一键报修" in entries
    assert "系统内AI聊天框" in entries


def test_repair_center_message_list_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """docs/06 · 统一报修中心消息池：非 PG 503；PG 须 JWT；带 JWT 信封或缺表 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/repair-center/messages")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/repair-center/messages", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert "items" in data and "total" in data and "page" in data and "page_size" in data
    assert "stats" in data


def test_repair_center_routes_require_auth_by_dialect(client: TestClient) -> None:
    """统一报修中心工作台、待确认池、渠道、规则、进度查询均须院内 JWT。"""
    from app.db.session import engine

    calls = [
        ("GET", "/api/v1/repair-center/workbench", None),
        ("GET", "/api/v1/repair-center/pending-confirmations", None),
        ("GET", "/api/v1/repair-center/channel-configs", None),
        ("GET", "/api/v1/repair-center/rule-config", None),
        ("GET", "/api/v1/repair-center/progress", None),
        ("POST", "/api/v1/repair-center/ai-sessions", {"source_channel": "AI_CHAT"}),
        (
            "POST",
            "/api/v1/repair-center/messages",
            {
                "source_channel": "AI_CHAT",
                "raw_message_type": "TEXT",
                "raw_message_content": "ICU 5床监护仪血压打不上去，一直报警。",
            },
        ),
        (
            "POST",
            "/api/v1/repair-center/channel-configs",
            {"channel_name": "飞书机器人", "channel_type": "FEISHU"},
        ),
        ("PATCH", "/api/v1/repair-center/rule-config", {"night_shift_notify": True}),
    ]
    for method, path, body in calls:
        res = client.request(method, path, json=body)
        if engine.dialect.name != "postgresql":
            assert res.status_code == 503, path
        else:
            assert res.status_code == 401, path


def test_dashboard_hospital_summary_contract(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """docs/06 · GET /dashboard/hospital-summary：信封与非 PG/SQLite 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/dashboard/hospital-summary")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/dashboard/hospital-summary", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert isinstance(data.get("generated_at"), str)
    assets = data.get("assets")
    repairs = data.get("repairs")
    assert isinstance(assets, dict) and isinstance(repairs, dict)
    assert "total" in assets and "active_count" in assets
    assert "by_main_status" in assets and "top_categories" in assets
    assert "today_created" in repairs and "open_orders" in repairs and "by_order_status" in repairs


def test_pm_plans_list_contract(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """docs/06 · 十 · GET /pm/plans：非 PG 503；PG 无 JWT 401；带 JWT 信封或缺表 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/pm/plans")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/pm/plans", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert isinstance(data.get("items"), list)
    assert "total" in data and "page" in data and "page_size" in data


def test_dashboard_extended_stats_contract(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """docs/06 · GET /dashboard/repair-trend、finance-payment-summary、workspace-tasks：信封与非 PG 503。"""
    from app.db.session import engine

    paths_expect = [
        ("/api/v1/dashboard/repair-trend?days=7", ("labels", "reported", "completed")),
        ("/api/v1/dashboard/finance-payment-summary?days=30", ("bars",)),
        ("/api/v1/dashboard/workspace-tasks?task_limit=5", ("workflow", "repairs_preview")),
    ]
    if engine.dialect.name != "postgresql":
        for path, _ in paths_expect:
            assert client.get(path).status_code == 503
        return

    h = skip_without_identity_jwt(pg_admin_headers)
    for path, keys in paths_expect:
        assert client.get(path).status_code == 401
        ok = client.get(path, headers=h)
        assert ok.status_code in (200, 503), ok.text
        if ok.status_code == 503:
            continue
        body = ok.json()
        assert_api_envelope(body)
        data = body["data"]
        assert isinstance(data, dict)
        for k in keys:
            assert k in data
        if "labels" in data:
            assert isinstance(data["labels"], list)
            assert isinstance(data["reported"], list)
            assert isinstance(data["completed"], list)
        if path.endswith("/workspace-tasks?task_limit=5"):
            rp = data.get("repairs_preview")
            if isinstance(rp, list) and rp:
                assert "id" in rp[0]


def test_scan_asset_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§一·6：未配置 PG 时 503；配置 PG 时无令牌 401；有令牌时无效令牌 404 或台账未就绪 503。"""
    from app.db.session import engine

    res = client.post("/api/v1/scan/asset", json={"qr_token": "x" * 16})
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    res2 = client.post("/api/v1/scan/asset", json={"qr_token": "x" * 16}, headers=h)
    assert res2.status_code in (404, 503), res2.text


def test_asset_print_label_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§一·7：资产标签打印载荷；平台返回精臣 SDK 数据，终端本机打印。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000021"
    res = client.get(f"/api/v1/assets/{z}/print-label")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401

    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get(f"/api/v1/assets/{z}/print-label", headers=h)
    assert ok.status_code in (404, 503), ok.text


def test_asset_label_templates_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§一·7a：资产标签模板预设；平台统一纸张类型、尺寸和版式。"""
    from app.db.session import engine

    res = client.get("/api/v1/assets/label-templates")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401

    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/assets/label-templates", headers=h)
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert data["default_template_code"] == "ASSET_QR_50X30_V1"
    assert any(x["template_code"] == "ASSET_QR_60X40_DETAIL" for x in data["items"])
    assert any(x["template_code"] == "ASSET_QR_60X40_SINGLE_FEED" for x in data["items"])
    assert any(x["template_code"] == "ASSET_QR_50X25_TRANSFER" for x in data["items"])


def test_audit_logs_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§九·1：须特权 JWT；PostgreSQL 上缺审计表时 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/audit/logs")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/audit/logs", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert "items" in data and "total" in data and "page" in data and "page_size" in data


def test_supplier_navigation_envelope_contains_finance_links(client: TestClient) -> None:
    """`/suppliers` 导航信封含门户与院内财务前缀（对齐 docs §四～五 路径发现）。"""
    res = client.get("/api/v1/suppliers")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    d = body["data"]
    assert d.get("finance_admin_api_base") == "/api/v1/finance"
    pf = d.get("portal_finance")
    assert isinstance(pf, dict)
    assert pf.get("payables") == "/api/v1/supplier-portal/payables"


def test_finance_root_navigation_contains_paths(client: TestClient) -> None:
    """`/finance` 模块根路径补充资源前缀，便于网关/前端发现。"""
    res = client.get("/api/v1/finance")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    d = body["data"]
    paths = d.get("paths")
    assert isinstance(paths, dict) and paths.get("payables") == "/api/v1/finance/payables"
    sp = d.get("supplier_portal_mirror")
    assert isinstance(sp, dict) and sp.get("invoices")


def test_kb_documents_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§七·2：知识库分页列表信封。"""
    from app.db.session import engine

    res = client.get("/api/v1/knowledge/documents")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/knowledge/documents", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert isinstance(data, dict)
    assert "items" in data and "total" in data and "page" in data and "page_size" in data


def test_kb_chat_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§七·3：问答占位信封（RAG 未接；含 interaction_id、references）。"""
    from app.db.session import engine

    res = client.post("/api/v1/knowledge/chat", json={"question": "x", "scope": "repair"})
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.post(
        "/api/v1/knowledge/chat",
        headers=h,
        json={"question": "监护仪常见故障？", "scope": "repair"},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert_api_envelope(body)
    assert body["data"].get("stub") is True
    assert isinstance(body["data"].get("references"), list)
    assert "interaction_id" in body["data"]
    assert body["data"].get("reference_search_degraded") in (True, False)


def test_kb_document_detail_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§七·4：单条知识文档须 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000077"
    res = client.get(f"/api/v1/knowledge/documents/{z}")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    det = client.get(f"/api/v1/knowledge/documents/{z}", headers=h)
    assert det.status_code in (200, 404, 503)


def test_ai_tasks_create_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§六·1：POST 创建任务须有 JWT。"""
    from app.db.session import engine

    res = client.post("/api/v1/ai/tasks", json={"task_type": "REPAIR_TRIAGE", "payload": {}})
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.post(
        "/api/v1/ai/tasks",
        headers=h,
        json={"task_type": "ROI_ANALYSIS", "payload": {"unit": "ICU"}},
    )
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    assert body["data"].get("status") == "SUCCEEDED"


def test_ai_root_navigation_contains_paths(client: TestClient) -> None:
    """`/ai` 模块根路径含 §六 常用子路径模板。"""
    res = client.get("/api/v1/ai")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    paths = body["data"].get("paths")
    assert isinstance(paths, dict)
    assert paths.get("tasks_create") == "/api/v1/ai/tasks"


def test_workflow_my_tasks_contract_by_dialect(client: TestClient, pg_admin_headers: dict[str, str] | None) -> None:
    """§八·2：我的待办分页。"""
    from app.db.session import engine

    res = client.get("/api/v1/workflows/tasks/my")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    ok = client.get("/api/v1/workflows/tasks/my", headers=h)
    assert ok.status_code in (200, 503), ok.text
    if ok.status_code == 503:
        return
    body = ok.json()
    assert_api_envelope(body)
    data = body["data"]
    assert isinstance(data, dict)
    assert "items" in data and "total" in data and "page" in data and "page_size" in data


def test_workflow_start_contract_by_dialect(client: TestClient) -> None:
    """§八·1：未认证不得启动实例（避免契约烟测在库内落脏数据）。"""
    from app.db.session import engine

    res = client.post("/api/v1/workflows/start", json={"process_key": "x", "title": "契约烟测不允许落库"})
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_workflow_root_navigation_contains_paths(client: TestClient) -> None:
    """`/workflows` 模块根路径含 §八 常用子路径前缀。"""
    res = client.get("/api/v1/workflows")
    assert res.status_code == 200
    body = res.json()
    assert_api_envelope(body)
    paths = body["data"].get("paths")
    assert isinstance(paths, dict)
    assert paths.get("tasks_my") == "/api/v1/workflows/tasks/my"


def test_supplier_portal_dashboard_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§四·2：仪表盘须供应商 JWT；院内令牌不得访问。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/dashboard")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    x = client.get("/api/v1/supplier-portal/dashboard", headers=h)
    assert x.status_code == 403


def test_supplier_portal_login_contract(client: TestClient) -> None:
    """§四·1：PostgreSQL 上错误口令 401；门户账号表缺失时 503。"""
    from app.db.session import engine

    res = client.post(
        "/api/v1/supplier-portal/auth/login",
        json={"username": "no_such_pytest_supplier_user", "password": "wrong"},
    )
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code in (401, 503), res.text


def test_supplier_projects_manage_requires_auth(client: TestClient) -> None:
    """§三：院内 `supplier-projects`（含 bids 列表）须 JWT。"""
    from app.db.session import engine

    pub = client.post("/api/v1/supplier-projects", json={"title": "x"})
    lst = client.get("/api/v1/supplier-projects")
    bids = client.get("/api/v1/supplier-projects/00000000-0000-0000-0000-000000000001/bids")
    rev = client.post("/api/v1/supplier-projects/00000000-0000-0000-0000-000000000001/review", json={})

    if engine.dialect.name != "postgresql":
        assert pub.status_code == 503
        assert lst.status_code == 503
        assert bids.status_code == 503
        assert rev.status_code == 503
        return
    assert pub.status_code == 401
    assert lst.status_code == 401
    assert bids.status_code == 401
    assert rev.status_code == 401


def test_auth_login_on_postgres_allows_401_or_identity_503(client: TestClient) -> None:
    """院内登录：PostgreSQL 上口令错误 401；identity 表缺失时 503。"""
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    res = client.post("/api/v1/auth/login", json={"username": "__nope__pytest", "password": "x"})
    assert res.status_code in (401, 503), res.text


def test_supplier_projects_list_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§三：迁库后院内项目列表分页；未建 supplier 竞价表时 503。"""
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    res = client.get("/api/v1/supplier-projects", headers=h)
    assert res.status_code in (200, 503), res.text
    if res.status_code == 503:
        return
    body = res.json()
    assert_api_envelope(body)
    assert "items" in body["data"] and "total" in body["data"]


def test_supplier_portal_submit_bid_requires_supplier_auth(client: TestClient) -> None:
    """§四：门户报价须供应商 JWT。"""
    from app.db.session import engine

    res = client.post(
        "/api/v1/supplier-portal/projects/00000000-0000-0000-0000-000000000099/bids",
        json={"quoted_amount": 100},
    )
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_list_own_bids_requires_supplier_auth(client: TestClient) -> None:
    """门户查询本企业报价须供应商 JWT。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/projects/00000000-0000-0000-0000-000000000099/bids")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_project_detail_requires_supplier_auth(client: TestClient) -> None:
    """门户查看单个 OPEN 项目须供应商 JWT。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/projects/00000000-0000-0000-0000-000000000099")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_finance_invoice_routes_manage_requires_auth(client: TestClient) -> None:
    """§五：院内 `/finance/invoices` 须 JWT。"""
    from app.db.session import engine

    lst = client.get("/api/v1/finance/invoices")
    det = client.get("/api/v1/finance/invoices/00000000-0000-0000-0000-000000000001")
    rev = client.post(
        "/api/v1/finance/invoices/00000000-0000-0000-0000-000000000001/review",
        json={"confirm_status": "ACCEPTED"},
    )
    if engine.dialect.name != "postgresql":
        assert lst.status_code == 503
        assert det.status_code == 503
        assert rev.status_code == 503
        return
    assert lst.status_code == 401
    assert det.status_code == 401
    assert rev.status_code == 401


def test_finance_invoice_upload_contract_by_dialect(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§五·1：Multipart 上传；须 `RBAC_FINANCE_UPLOAD`。MinIO/PG 未就绪或非 500；库表齐备且主体存在时可为 200。"""
    import uuid as _uuid

    from app.db.session import engine

    zorg = str(_uuid.uuid4())
    files = {"file": ("stub.pdf", b"%PDF-1.5\n%\xe2\xe3\xcf\xd3 pytest\n", "application/pdf")}
    data = {"organization_id": zorg}

    anon = client.post("/api/v1/finance/invoices/upload", files=files, data=data)
    if engine.dialect.name != "postgresql":
        assert anon.status_code == 503, anon.text
        return
    assert anon.status_code == 401, anon.text

    h = skip_without_identity_jwt(pg_admin_headers)
    authed = client.post(
        "/api/v1/finance/invoices/upload",
        headers=h,
        files=files,
        data=data,
    )
    assert authed.status_code in (200, 404, 503), authed.text
    if authed.status_code == 200:
        assert_api_envelope(authed.json())


def test_finance_payables_payment_aging_priority_routes_require_auth(client: TestClient) -> None:
    """§五·5～8：应付列表/详情、补录、账龄、付款列表/详情、登记、付款优先级须院内 JWT。"""
    from app.db.session import engine

    pb = client.get("/api/v1/finance/payables")
    zid = "00000000-0000-0000-0000-000000000099"
    pyd = client.get(f"/api/v1/finance/payables/{zid}")
    plist = client.get("/api/v1/finance/payments")
    pmd = client.get(f"/api/v1/finance/payments/{zid}")
    ag = client.get("/api/v1/finance/aging-analysis")
    cr = client.post(
        "/api/v1/finance/payables",
        json={"supplier_id": "00000000-0000-0000-0000-000000000001", "title": "x", "amount_due": "1"},
    )
    pay = client.post(
        "/api/v1/finance/payments",
        json={
            "supplier_id": "00000000-0000-0000-0000-000000000001",
            "payment_amount": "1",
            "payment_date": "2026-05-08",
            "allocations": [
                {"payable_id": "00000000-0000-0000-0000-000000000002", "allocated_amount": "1"},
            ],
        },
    )
    ai = client.post("/api/v1/finance/payment-priority/ai-analyze", json={})
    if engine.dialect.name != "postgresql":
        assert pb.status_code == 503
        assert pyd.status_code == 503
        assert plist.status_code == 503
        assert pmd.status_code == 503
        assert ag.status_code == 503
        assert cr.status_code == 503
        assert pay.status_code == 503
        assert ai.status_code == 503
        return
    assert pb.status_code == 401
    assert pyd.status_code == 401
    assert plist.status_code == 401
    assert pmd.status_code == 401
    assert ag.status_code == 401
    assert cr.status_code == 401
    assert pay.status_code == 401
    assert ai.status_code == 401


def test_supplier_portal_invoices_requires_supplier_auth(client: TestClient) -> None:
    """§四·6：门户发票列表须供应商 JWT。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/invoices")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_invoice_detail_requires_supplier_auth(client: TestClient) -> None:
    """§四·6：门户发票单条须供应商 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000011"
    res = client.get(f"/api/v1/supplier-portal/invoices/{z}")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_qualification_detail_requires_supplier_auth(client: TestClient) -> None:
    """§四·4：门户资质单条须供应商 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000033"
    res = client.get(f"/api/v1/supplier-portal/qualifications/{z}")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_payables_requires_supplier_auth(client: TestClient) -> None:
    """§四·5：门户应付列表须供应商 JWT。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/payables")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_payable_detail_requires_supplier_auth(client: TestClient) -> None:
    """§四·5：门户应付单条须供应商 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000044"
    res = client.get(f"/api/v1/supplier-portal/payables/{z}")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_payments_requires_supplier_auth(client: TestClient) -> None:
    """§四·7：门户付款列表须供应商 JWT。"""
    from app.db.session import engine

    res = client.get("/api/v1/supplier-portal/payments")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_supplier_portal_payment_detail_requires_supplier_auth(client: TestClient) -> None:
    """§四·7：门户付款单条须供应商 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-4000-8000-000000000022"
    res = client.get(f"/api/v1/supplier-portal/payments/{z}")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401


def test_suppliers_qualifications_hospital_routes_require_auth(client: TestClient) -> None:
    """§三·7～8：院内资质分页与审核须院内 JWT。"""
    from app.db.session import engine

    z = "00000000-0000-0000-0000-0000000000bb"
    base = "/api/v1/suppliers/qualifications"
    lst = client.get(base)
    det = client.get(f"{base}/{z}")
    rev = client.post(f"{base}/{z}/review", json={"confirm_status": "REJECTED"})
    if engine.dialect.name != "postgresql":
        assert lst.status_code == 503
        assert det.status_code == 503
        assert rev.status_code == 503
        return
    assert lst.status_code == 401
    assert det.status_code == 401
    assert rev.status_code == 401


def test_health_plain_json_not_api_envelope(client: TestClient) -> None:
    """存活探针不走路由信封，便于 K8s / LB 探测。"""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_system_roles_users_require_auth(client: TestClient) -> None:
    """§十三：系统角色目录与用户列表须 JWT；非 PG 时 503。"""
    from app.db.session import engine

    r1 = client.get("/api/v1/system/roles")
    r2 = client.get("/api/v1/system/users")
    if engine.dialect.name != "postgresql":
        assert r1.status_code == 503
        assert r2.status_code == 503
        return
    assert r1.status_code == 401
    assert r2.status_code == 401


def test_system_roles_users_envelope_with_admin_jwt(
    client: TestClient, pg_admin_headers: dict[str, str] | None
) -> None:
    """§十三·1、§十三·7：特权 JWT 下信封与分页字段合法。"""
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        return
    h = skip_without_identity_jwt(pg_admin_headers)
    roles = client.get("/api/v1/system/roles", headers=h)
    assert roles.status_code == 200, roles.text
    body = roles.json()
    assert_api_envelope(body)
    assert isinstance(body["data"], dict)
    assert "items" in body["data"]
    assert isinstance(body["data"]["items"], list)
    codes = {x["code"] for x in body["data"]["items"]}
    assert "SYS_ADMIN" in codes

    users = client.get("/api/v1/system/users?page=1&page_size=10", headers=h)
    assert users.status_code == 200, users.text
    ub = users.json()
    assert_api_envelope(ub)
    data = ub["data"]
    assert isinstance(data, dict)
    for k in ("items", "total", "page", "page_size"):
        assert k in data



