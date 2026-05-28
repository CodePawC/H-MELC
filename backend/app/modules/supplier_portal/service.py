"""供应商门户业务逻辑（登录 JWT、dashboard、资质）。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.ai.models import AiResult
from app.modules.auth.jwt_tools import create_access_token
from app.modules.auth.service import verify_password
from app.modules.audit.schemas import AuditLogCreate
from app.modules.audit.service import append_log
from app.modules.finance import service as fin_svc
from app.modules.finance.models import Invoice
from app.modules.supplier_portal.models import (
    SupplierOrganization,
    SupplierPortalAccount,
    SupplierQualification,
)
from app.modules.supplier_portal.schemas import SupplierTokenEnvelope, SupplierUserPublic
from app.modules.supplier_projects.models import ProcurementBid


def authenticate_portal(session: Session, username: str, password: str) -> SupplierTokenEnvelope | None:
    row = session.execute(
        select(SupplierPortalAccount)
        .options(joinedload(SupplierPortalAccount.organization))
        .where(SupplierPortalAccount.username == username)
    ).scalar_one_or_none()
    if row is None or not row.is_active:
        return None
    if not verify_password(password, row.password_hash):
        return None
    org = row.organization
    if org is None:
        return None
    pub = SupplierUserPublic(
        id=row.id,
        username=row.username,
        organization_id=row.organization_id,
        legal_name=org.legal_name,
        roles=["SUPPLIER"],
    )
    token, ttl = create_access_token(subject=row.id, username=row.username, roles=["SUPPLIER"])
    append_log(
        session,
        AuditLogCreate(
            action="SUPPLIER_PORTAL_LOGIN_SUCCESS",
            user_id=row.id,
            username=row.username,
            role_code="SUPPLIER",
            object_type="supplier_portal",
            after_data={"organization_id": str(row.organization_id)},
        ),
    )
    return SupplierTokenEnvelope(access_token=token, expires_in=ttl, user=pub)


def dashboard_snapshot(session: Session, *, organization_id: UUID) -> dict[str, Any]:
    """§四·2 字段形状；应付/付款对齐 finance；待补材料见资质条目规则。"""
    participated = session.scalar(
        select(func.count(func.distinct(ProcurementBid.project_id))).where(
            ProcurementBid.organization_id == organization_id
        )
    ) or 0
    unpaid_dec = fin_svc.unpaid_balance_for_organization(session, organization_id)
    paid_dec = fin_svc.paid_total_for_organization(session, organization_id)
    pending_inv = session.scalar(
        select(func.count(Invoice.id))
        .select_from(Invoice)
        .join(AiResult, AiResult.id == Invoice.ai_result_id)
        .where(Invoice.organization_id == organization_id, AiResult.review_status == "PENDING")
    ) or 0
    missing_material = session.scalar(
        select(func.count(SupplierQualification.id)).where(
            SupplierQualification.organization_id == organization_id,
            or_(
                SupplierQualification.review_status == "REJECTED",
                SupplierQualification.object_key.is_(None),
            ),
        )
    ) or 0
    den = float(unpaid_dec + paid_dec)
    pct = (100.0 * float(paid_dec) / den) if den > 0 else 0.0
    return {
        "unpaid_amount": float(unpaid_dec),
        "paid_amount": float(paid_dec),
        "pending_invoice_count": int(pending_inv),
        "missing_material_count": int(missing_material),
        "active_projects_count": int(participated),
        "payment_progress_pct": round(pct, 2),
    }


def list_qualifications(
    session: Session, *, organization_id: UUID, page: int, page_size: int
) -> tuple[list[SupplierQualification], int]:
    flt = SupplierQualification.organization_id == organization_id
    cnt = session.scalar(select(func.count(SupplierQualification.id)).where(flt)) or 0
    total = int(cnt)
    rows = session.scalars(
        select(SupplierQualification)
        .where(flt)
        .order_by(SupplierQualification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def get_qualification_for_portal(
    session: Session, qualification_id: UUID, *, organization_id: UUID
) -> SupplierQualification | None:
    """单条资质，且须属于给定门户组织。"""
    row = session.get(SupplierQualification, qualification_id)
    if row is None or row.organization_id != organization_id:
        return None
    return row


def qual_to_api(row: SupplierQualification, *, organization_legal_name: str | None = None) -> dict[str, Any]:
    out = {
        "id": row.id,
        "organization_id": row.organization_id,
        "title": row.title,
        "credential_type": row.credential_type,
        "review_status": row.review_status,
        "object_key": row.object_key,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "reviewed_by_user_id": row.reviewed_by_user_id,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "review_comment": row.review_comment,
        "created_at": row.created_at,
    }
    if organization_legal_name is not None:
        out["organization_legal_name"] = organization_legal_name
    return out


def create_qualification_record(
    session: Session,
    *,
    organization_id: UUID,
    title: str,
    credential_type: str | None,
    object_key: str | None,
    mime_type: str | None,
    file_size: int | None,
) -> SupplierQualification:
    q = SupplierQualification(
        id=uuid.uuid4(),
        organization_id=organization_id,
        title=title,
        credential_type=credential_type,
        review_status="PENDING",
        object_key=object_key,
        mime_type=mime_type,
        file_size=file_size,
    )
    session.add(q)
    session.commit()
    session.refresh(q)
    return q


def list_qualifications_for_hospital(
    session: Session,
    *,
    organization_id: UUID | None,
    review_status: str | None,
    page: int,
    page_size: int,
) -> tuple[list[tuple[SupplierQualification, str]], int]:
    """§三·7：院内分页；返回 (资质行, 供应商法定名称)。"""
    parts: list[Any] = []
    if organization_id is not None:
        parts.append(SupplierQualification.organization_id == organization_id)
    if review_status is not None and str(review_status).upper() != "ALL":
        parts.append(SupplierQualification.review_status == str(review_status).upper())
    stmt = (
        select(SupplierQualification, SupplierOrganization.legal_name)
        .join(SupplierOrganization, SupplierOrganization.id == SupplierQualification.organization_id)
        .order_by(SupplierQualification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    cnt_stmt = select(func.count(SupplierQualification.id)).select_from(SupplierQualification)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    cnt = session.scalar(cnt_stmt) or 0
    rows = session.execute(stmt).all()
    return [(q, legal) for q, legal in rows], int(cnt)


def get_qualification_for_hospital(
    session: Session, qualification_id: UUID
) -> tuple[SupplierQualification, str] | None:
    """单条资质 + 法人名称（院内钻取详情）。"""
    stmt = (
        select(SupplierQualification, SupplierOrganization.legal_name)
        .join(SupplierOrganization, SupplierOrganization.id == SupplierQualification.organization_id)
        .where(SupplierQualification.id == qualification_id)
    )
    hit = session.execute(stmt).first()
    if hit is None:
        return None
    return hit[0], str(hit[1])


def review_qualification_for_hospital(
    session: Session,
    qualification_id: UUID,
    *,
    reviewer_user_id: UUID,
    decision: Literal["ACCEPTED", "REJECTED"],
    comment: str | None,
) -> SupplierQualification | tuple[Literal["not_found", "conflict"], str]:
    """§三·8：`ACCEPTED` 为终态；`PENDING`/`REJECTED` 可再次审核。"""
    row = session.get(SupplierQualification, qualification_id)
    if row is None:
        return "not_found", "资质记录不存在"
    if row.review_status == "ACCEPTED":
        return "conflict", "已通过审核的资质不可再次修改"
    row.review_status = decision
    row.reviewed_by_user_id = reviewer_user_id
    row.reviewed_at = datetime.now(timezone.utc)
    row.review_comment = comment
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


__all__ = [
    "authenticate_portal",
    "create_qualification_record",
    "dashboard_snapshot",
    "get_qualification_for_hospital",
    "get_qualification_for_portal",
    "list_qualifications",
    "list_qualifications_for_hospital",
    "qual_to_api",
    "review_qualification_for_hospital",
]
