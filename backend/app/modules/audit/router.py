"""审计 API。

对齐：docs/06_接口设计/01_API接口设计.md §九；持久化 docs/03_数据库设计/04 §八、e004_audit_core。

§九：仅审计科、系统管理员可访问 — 需携带 JWT，角色包含 `AUDIT_ADMIN` 或 `SYS_ADMIN`。
PostgreSQL 已连接但未建审计表时，列表查询捕获 SQL 异常并返回 **503**（与 `_AUDIT_PG_NOT_READY` 一致）。
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.audit.service import list_logs
from app.modules.auth.deps import require_roles
from app.modules.auth.schemas import JwtClaims


def _audit_store_only() -> None:
    """与台账/维修模块一致：非 PG 或未迁移时用 503 提示。"""
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="审计日志需在 PostgreSQL 执行 `alembic upgrade head`（含 e004_audit_core）后查询。",
        )


RequireAuditStore = Depends(_audit_store_only)

_AUDIT_PG_NOT_READY = (
    "审计日志持久化未就绪：请在目标库执行 alembic upgrade head（含 e004_audit_core）。"
)

router = APIRouter(tags=["audit"])


@router.get(
    "/audit/logs",
    summary="查询操作日志 §九·1",
    dependencies=[RequireAuditStore],
)
def audit_logs_list(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles("AUDIT_ADMIN", "SYS_ADMIN")),
    user_id: UUID | None = Query(None),
    username: str | None = Query(None, description="模糊匹配用户名"),
    role_code: str | None = Query(None),
    action: str | None = Query(None, description="模糊匹配 action"),
    object_type: str | None = Query(None),
    object_id: UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = list_logs(
            db,
            user_id=user_id,
            username=username,
            role_code=role_code,
            action=action,
            object_type=object_type,
            object_id=object_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AUDIT_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": pg,
            "page_size": psz,
        }
    )


@router.get(
    "/system/audit-events",
    summary="兼容旧占位路径（分页查询等价）",
    dependencies=[RequireAuditStore],
    deprecated=True,
)
def audit_events_compat(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles("AUDIT_ADMIN", "SYS_ADMIN")),
    action: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """曾与文档 §九 对齐前使用；优先使用 `/api/v1/audit/logs`。"""
    try:
        items, total, pg, psz = list_logs(db, action=action, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AUDIT_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "legacy_path": "/api/v1/system/audit-events",
            "recommended_path": "/api/v1/audit/logs",
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": pg,
            "page_size": psz,
        }
    )
