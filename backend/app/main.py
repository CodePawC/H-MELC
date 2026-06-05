"""FastAPI 应用入口。

对齐：
- docs/06_接口设计/01_API接口设计.md · 业务 API 由 register_routers 挂在 /api/v1
- docs/07_部署运维 · GET /health 与 GET /health/ready 用于探针（不走 API 信封；ready 含可选 ``alembic_version`` 观测）

说明：存活/就绪路由故意不使用 {code, message, data}，便于网关与编排直接判断。
"""

from contextlib import asynccontextmanager
from urllib.parse import urlparse, urlunparse

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.integrations.minio_client import ensure_minio_bucket
from app.modules import register_routers
from app.db.session import engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 若能连 MinIO 且配置了密钥，则确保业务桶存在；失败不阻塞进程（方便仅 DB 开发）。
    try:
        ensure_minio_bucket()
    except Exception:
        pass
    yield


app = FastAPI(
    title="H-MELC 医院医学装备全生命周期闭环管理平台",
    description="设备台账、报修维修、供应商协同、发票付款、工作流与 AI 能力 API",
    version="0.1.0",
    lifespan=lifespan,
)


def _configure_cors() -> None:
    from app.core.config import get_settings

    s = get_settings()
    origins = [x.strip() for x in s.cors_origins.split(",") if x.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


_configure_cors()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """生产安全响应头（等保合规）。"""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self' data:; "
            "frame-ancestors 'none'"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)


def _sanitize_database_url(database_url: str) -> str:
    if "@" not in database_url or database_url.startswith("sqlite"):
        return database_url
    try:
        p = urlparse(database_url)
        if not p.password:
            return database_url
        netloc = f"{p.username}:***@{p.hostname}"
        if p.port:
            netloc += f":{p.port}"
        return urlunparse((p.scheme, netloc, p.path or "", "", p.query or "", ""))
    except ValueError:
        return "<invalid database_url>"


def _masked_database_url() -> str:
    from app.core.config import get_settings

    return _sanitize_database_url(get_settings().database_url)


def _probe_alembic_revision_for_ready() -> str:
    """仅观测：不参与就绪判定（空库或未建 alembic 表亦为「库已通」）。

    SQLite 返回 ``n/a``；PostgreSQL 可读则返回单行 ``version_num``，否则 ``unavailable``。"""
    if engine.dialect.name != "postgresql":
        return "n/a"
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
            ).fetchone()
        return row[0] if row else "empty"
    except Exception:
        return "unavailable"


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["system"])
def health_ready() -> JSONResponse:
    """PostgreSQL 必选通过；Redis/MinIO 在已配置时出现异常则判整体未就绪。

    ``checks["alembic_version"]`` 为 Alembic 当前库版本摘要（不参与就绪门禁，便于运维区分「连通」与「已迁」）。
    """
    from app.core.redis_client import ping_redis
    from app.integrations.minio_client import ping_minio

    checks: dict[str, str] = {}
    ok = True

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error:{e!s}"[:200]
        ok = False

    if checks.get("database") == "ok":
        checks["alembic_version"] = _probe_alembic_revision_for_ready()

    r = ping_redis()
    if r is False:
        checks["redis"] = "error"
        ok = False
    elif r is True:
        checks["redis"] = "ok"
    else:
        checks["redis"] = "skipped"

    m = ping_minio()
    if m is False:
        checks["minio"] = "error"
        ok = False
    elif m is True:
        checks["minio"] = "ok"
    else:
        checks["minio"] = "skipped"

    payload = {
        "status": "ready" if ok else "not_ready",
        "checks": checks,
        "database_url": _masked_database_url(),
    }
    code = status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(payload, status_code=code)


register_routers(app)


def openapi_with_bearer() -> dict[str, object]:
    """Swagger：`HTTP Bearer` JWT 声明（由各路由运行时校验令牌）。"""
    from fastapi.openapi.utils import get_openapi

    if app.openapi_schema:
        return app.openapi_schema

    desc = app.description or ""
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=getattr(app, "openapi_version", "3.1.0"),
        description=desc + "\n业务 API 建议携带 `Authorization: Bearer <JWT>`（见 `POST /api/v1/auth/login`）。",
        routes=app.routes,
    )
    comps = openapi_schema.setdefault("components", {})
    comps.setdefault("securitySchemes", {})["HTTPBearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "先调用 `/api/v1/auth/login` 获取 access_token。",
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = openapi_with_bearer  # type: ignore[method-assign]
