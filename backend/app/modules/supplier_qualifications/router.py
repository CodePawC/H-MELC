"""院内供应商资质查询与审核 HTTP API。

对齐 docs/06_接口设计/01 §三·7～8；PostgreSQL `supplier.qualification` 审计列见 **e016**。
已连 PG 但未建相关表时：**SQLAlchemyError** → **503**（`_SUPPLIER_QUAL_PG_NOT_READY`）。
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
from app.modules.auth.rbac import RBAC_SUPPLIER_QUALIFICATION_READ, RBAC_SUPPLIER_QUALIFICATION_REVIEW
from app.modules.auth.schemas import JwtClaims
from app.modules.supplier_portal import service as sp_svc
from app.modules.supplier_portal.schemas import QualificationReviewBody

router = APIRouter(prefix="/suppliers/qualifications", tags=["supplier-qualifications"])


def _ensure_pg_supplier_qual_audit() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="院内资质审核需在 PostgreSQL 执行 `alembic upgrade head`（含 e009 supplier、e016 资质审核列）后使用。",
        )


PgSupplierQualStore = Depends(_ensure_pg_supplier_qual_audit)

_SUPPLIER_QUAL_PG_NOT_READY = (
    "院内资质审核持久化未就绪：请在目标库执行 alembic upgrade head（含 e009 supplier、e016 资质审核列）。"
)


@router.get("", dependencies=[PgSupplierQualStore])
def hospital_list_qualifications(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_SUPPLIER_QUALIFICATION_READ)),
    organization_id: UUID | None = Query(None, description="supplier.organization.id"),
    review_status: str | None = Query(None, description="PENDING/ACCEPTED/REJECTED 或 ALL（默认不按状态过滤）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§三·7"""
    try:
        rows, total = sp_svc.list_qualifications_for_hospital(
            db,
            organization_id=organization_id,
            review_status=review_status,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SUPPLIER_QUAL_PG_NOT_READY
        ) from exc
    items = [sp_svc.qual_to_api(q, organization_legal_name=legal) for q, legal in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/{qualification_id}", dependencies=[PgSupplierQualStore])
def hospital_get_qualification(
    db: DbSession,
    qualification_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_SUPPLIER_QUALIFICATION_READ)),
) -> dict:
    """§三·7 单条资质（院内钻取，与分页列表条目同一数据结构）。"""
    try:
        hit = sp_svc.get_qualification_for_hospital(db, qualification_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SUPPLIER_QUAL_PG_NOT_READY
        ) from exc
    if hit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资质不存在")
    row, legal = hit
    return envelope_ok(data=sp_svc.qual_to_api(row, organization_legal_name=legal))


@router.post("/{qualification_id}/review", dependencies=[PgSupplierQualStore])
def hospital_review_qualification(
    db: DbSession,
    qualification_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_SUPPLIER_QUALIFICATION_REVIEW)),
    body: QualificationReviewBody = Body(...),
) -> dict:
    """§三·8"""
    try:
        raw = sp_svc.review_qualification_for_hospital(
            db,
            qualification_id,
            reviewer_user_id=actor.sub,
            decision=body.confirm_status,
            comment=body.comment,
        )
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        row = raw
        emit_audit(
            db,
            actor,
            action="SUPPLIER_QUALIFICATION_REVIEW",
            object_type="supplier_qualification",
            object_id=qualification_id,
            after_data={
                "review_status": row.review_status,
                "organization_id": str(row.organization_id),
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SUPPLIER_QUAL_PG_NOT_READY
        ) from exc
    return envelope_ok(data=sp_svc.qual_to_api(row))
