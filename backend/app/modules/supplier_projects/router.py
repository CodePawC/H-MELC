"""院内发布与维护竞价项目 supplier-projects。

对齐：docs/06_接口设计/01_API接口设计.md §三·3、§三·6；门户浏览见 `GET /supplier-portal/projects`。
持久化：`supplier.procurement_project` / `supplier.procurement_bid`，Alembic e010–e013；
已连 PG 但未迁库时捕获 SQL 异常返回 **503**。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_PROCUREMENT_PUBLISH, RBAC_PROCUREMENT_READ, RBAC_PROCUREMENT_REVIEW
from app.modules.auth.schemas import JwtClaims
from app.modules.supplier_projects.schemas import (
    ProcurementProjectCreate,
    ProcurementProjectReviewBody,
)
from app.modules.supplier_projects import service as pr_svc


router = APIRouter(prefix="/supplier-projects", tags=["supplier-projects"])


def _ensure_pg_procurement() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="竞价项目需在 PostgreSQL 执行 `alembic upgrade head`（含 e010–e013，含中选报价字段）后使用。",
        )


PgProcurementStore = Depends(_ensure_pg_procurement)

_PROCUREMENT_PG_NOT_READY = (
    "竞价项目持久化未就绪：请在目标库执行 alembic upgrade head（含 e010–e013）。"
)


@router.post("", dependencies=[PgProcurementStore])
def publish_procurement_project(
    db: DbSession,
    body: ProcurementProjectCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_PUBLISH)),
) -> dict:
    """§三·3"""
    try:
        out = pr_svc.create_project(db, body, publisher_user_id=actor.sub)
        if isinstance(out, tuple):
            code, msg = out
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        row = out
        emit_audit(
            db,
            actor,
            action="PROCUREMENT_PROJECT_PUBLISH",
            object_type="procurement_project",
            object_id=row.id,
            after_data={"title": row.title, "repair_order_id": str(row.repair_order_id) if row.repair_order_id else None},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PROCUREMENT_PG_NOT_READY) from exc
    return envelope_ok(data=pr_svc.row_to_admin(row))


@router.get("", dependencies=[PgProcurementStore])
def list_procurement_projects(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
    order_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = pr_svc.list_projects(db, status=order_status, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PROCUREMENT_PG_NOT_READY) from exc
    return envelope_ok(
        data={"items": [pr_svc.row_to_admin(r) for r in rows], "total": total, "page": page, "page_size": page_size}
    )


@router.get("/{project_id}/bids", dependencies=[PgProcurementStore])
def list_procurement_project_bids(
    db: DbSession,
    project_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
) -> dict:
    """项目已收到的门户报价条目。"""
    try:
        items, err = pr_svc.list_bids_for_project(db, project_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PROCUREMENT_PG_NOT_READY) from exc
    if err == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return envelope_ok(data={"items": items, "total": len(items)})


@router.get("/{project_id}", dependencies=[PgProcurementStore])
def get_procurement_project(
    db: DbSession,
    project_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
) -> dict:
    try:
        row = pr_svc.get_project(db, project_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PROCUREMENT_PG_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return envelope_ok(data=pr_svc.row_to_admin(row))


@router.post("/{project_id}/review", dependencies=[PgProcurementStore])
def review_procurement_project(
    db: DbSession,
    project_id: UUID,
    body: ProcurementProjectReviewBody = Body(default_factory=ProcurementProjectReviewBody),
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_REVIEW)),
) -> dict:
    """§三·6"""
    try:
        raw = pr_svc.apply_procurement_review(db, project_id, reviewer_user_id=actor.sub, body=body)
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(msg))
            if code in ("bad_bid", "bad_request"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(msg))
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(msg))
        row = raw
        emit_audit(
            db,
            actor,
            action="PROCUREMENT_PROJECT_REVIEW",
            object_type="procurement_project",
            object_id=project_id,
            after_data={
                "status": row.status,
                "decision": body.decision,
                "remark": body.remark,
                "winning_bid_id": str(row.winning_bid_id) if row.winning_bid_id else None,
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PROCUREMENT_PG_NOT_READY) from exc
    return envelope_ok(data=pr_svc.row_to_admin(row))

