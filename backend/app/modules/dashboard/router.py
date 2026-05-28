"""工作台驾驶舱 HTTP API。

对齐 docs/06_接口设计/01_API接口设计.md · GET /dashboard/hospital-summary（院内首页数据聚合）。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_ASSET_READ, RBAC_FINANCE_READ, RBAC_REPAIR_READ
from app.modules.auth.schemas import JwtClaims
from app.modules.dashboard import service as dash_svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_PG_REQUIRED = (
    "工作台汇总需在 PostgreSQL 执行 `alembic upgrade head`（含 asset / repair 相关迁移）后使用。"
)


def _ensure_pg_dashboard() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PG_REQUIRED)


PgDashboard = Depends(_ensure_pg_dashboard)


@router.get("/hospital-summary", dependencies=[PgDashboard])
def hospital_summary_endpoint(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """院内首页：台账分布 + 工单计数（实现期聚合；图表趋势后续单独接口）。"""
    try:
        payload = dash_svc.hospital_summary(db)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="工作台汇总查询失败：请确认 asset / repair 表已创建并完成迁移。",
        ) from exc
    return envelope_ok(data=payload)


@router.get("/repair-trend", dependencies=[PgDashboard])
def repair_trend_endpoint(
    db: DbSession,
    days: int = Query(default=7, ge=1, le=90),
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    """工单趋势：按日新建数与完成数。"""
    try:
        payload = dash_svc.repair_trend(db, days=days)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="工单趋势查询失败：请确认 repair 相关表已就绪。",
        ) from exc
    return envelope_ok(data=payload)


@router.get("/finance-payment-summary", dependencies=[PgDashboard])
def finance_payment_summary_endpoint(
    db: DbSession,
    days: int = Query(default=30, ge=1, le=366),
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
) -> dict:
    """财务付款/应付聚合（柱状图用）。"""
    try:
        payload = dash_svc.finance_payment_summary(db, days=days)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="财务汇总查询失败：请确认 finance 相关表已就绪。",
        ) from exc
    return envelope_ok(data=payload)


@router.get("/workspace-tasks", dependencies=[PgDashboard])
def workspace_tasks_endpoint(
    db: DbSession,
    task_limit: int = Query(default=8, ge=1, le=30),
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """待办与工作流任务摘要（当前用户 + 未闭环工单预览）。"""
    try:
        payload = dash_svc.workspace_tasks(db, user_id=actor.sub, task_limit=task_limit)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="工作台待办查询失败：请确认 repair / workflow 相关表已就绪。",
        ) from exc
    return envelope_ok(data=payload)
