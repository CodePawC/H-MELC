"""API v1 smoke / dialect split tests."""

from pg_jwt_helpers import skip_without_identity_jwt


def test_auth_login_requires_pg(client):
    """PostgreSQL 以外：认证入口 503（无 identity schema）。"""
    from app.db.session import engine

    if engine.dialect.name == "postgresql":
        return
    r = client.post("/api/v1/auth/login", json={"username": "x", "password": "y"})
    assert r.status_code == 503


def test_audit_logs_v1_by_dialect(client):
    """§九：`/audit/logs` 与遗留 `/system/audit-events`：SQLite 为 503；PostgreSQL 无令牌为 401。"""
    from app.db.session import engine

    for path in ("/api/v1/audit/logs", "/api/v1/system/audit-events"):
        res = client.get(path)
        if engine.dialect.name != "postgresql":
            assert res.status_code == 503, path
            continue
        assert res.status_code == 401, path


def test_repairs_v1_by_dialect(client, pg_admin_headers):
    """docs/06_接口设计 §二·2：SQLite 503；PG 无令牌 401；有令牌 200 或缺 repair 表 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/repairs")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401

    h = skip_without_identity_jwt(pg_admin_headers)
    res2 = client.get("/api/v1/repairs", headers=h)
    assert res2.status_code in (200, 503), res2.text
    if res2.status_code == 503:
        return
    body = res2.json()
    assert body["code"] == 0
    assert set(body["data"]) >= {"items", "total", "page", "page_size"}


def test_assets_v1_by_dialect(client, pg_admin_headers):
    """docs/06_接口设计 §一·1：SQLite 503；PG 无 Bearer 401；有 Bearer 200 或缺 asset 表 503。"""
    from app.db.session import engine

    res = client.get("/api/v1/assets")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    res2 = client.get("/api/v1/assets", headers=h)
    assert res2.status_code in (200, 503), res2.text
    if res2.status_code == 503:
        return
    body = res2.json()
    assert body["code"] == 0
    assert "items" in body["data"]


def test_mdm_category_entries_by_dialect(client, pg_admin_headers):
    """docs/01_需求文档/07：MDM 分类；SQLite 503；PostgreSQL 无 Bearer 401；可读角色 + JWT 200。"""
    from app.db.session import engine

    res = client.get("/api/v1/mdm/category-entries")
    if engine.dialect.name != "postgresql":
        assert res.status_code == 503
        return
    assert res.status_code == 401
    h = skip_without_identity_jwt(pg_admin_headers)
    res2 = client.get("/api/v1/mdm/category-entries", headers=h)
    assert res2.status_code in (200, 503), res2.text
    if res2.status_code == 503:
        return
    assert res2.json()["code"] == 0
    assert "items" in res2.json()["data"]


def test_health_ready_dependencies(client):
    """docs/07_部署运维：`/health/ready`——DB 必选；Redis/MiniIO 未配密钥时为 skipped，已配置但不可连为 error。

    （例如复制了示例 .env 含 MinIO 密钥却未启动 127.0.0.1:9000：minio==error → 503 not_ready）

    若数据库本身不可达（Postgres 未起、连接串错误等），`checks.database` 为 `error:` 前缀，`status=not_ready`、`503`——与生产探针一致，本用例视作通过。
    """
    res = client.get("/health/ready")
    js = res.json()
    db = js["checks"]["database"]

    if db != "ok":
        assert str(db).startswith("error:"), db
        assert js["status"] == "not_ready"
        assert res.status_code == 503
        return

    assert "alembic_version" in js["checks"]
    av = js["checks"]["alembic_version"]
    from app.db.session import engine

    if engine.dialect.name == "postgresql":
        assert isinstance(av, str) and av, av
    else:
        assert av == "n/a"

    assert js["checks"]["redis"] in ("ok", "skipped", "error")
    assert js["checks"]["minio"] in ("ok", "skipped", "error")

    has_dependency_error = js["checks"]["redis"] == "error" or js["checks"]["minio"] == "error"
    if has_dependency_error:
        assert js["status"] == "not_ready"
        assert res.status_code == 503
    else:
        assert js["status"] == "ready"
        assert res.status_code == 200
