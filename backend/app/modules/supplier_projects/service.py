"""院内 supplier-projects CRUD Phase 0。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.repair.models import RepairOrder
from app.modules.supplier_portal.models import SupplierOrganization
from app.modules.supplier_projects.models import ProcurementBid, ProcurementProject
from app.modules.supplier_projects.schemas import (
    ProcurementBidCreate,
    ProcurementProjectCreate,
    ProcurementProjectReviewBody,
)


def row_to_admin(r: ProcurementProject) -> dict[str, Any]:
    return {
        "id": r.id,
        "title": r.title,
        "summary": r.summary,
        "repair_order_id": r.repair_order_id,
        "status": r.status,
        "publisher_user_id": r.publisher_user_id,
        "bid_deadline": r.bid_deadline,
        "review_remark": r.review_remark,
        "reviewed_at": r.reviewed_at,
        "reviewer_user_id": r.reviewer_user_id,
        "winning_bid_id": r.winning_bid_id,
        "created_at": r.created_at,
    }


def row_to_portal(r: ProcurementProject) -> dict[str, Any]:
    return {
        "id": r.id,
        "title": r.title,
        "summary": r.summary,
        "status": r.status,
        "bid_deadline": r.bid_deadline,
        "created_at": r.created_at,
    }


def _assert_repair_order_exists(session: Session, ro_id: UUID) -> tuple[str, str] | None:
    row = session.get(RepairOrder, ro_id)
    if row is None:
        return "not_found", "关联工单不存在"
    return None


def create_project(
    session: Session, body: ProcurementProjectCreate, publisher_user_id: UUID
) -> ProcurementProject | tuple[str, str]:
    if body.repair_order_id is not None:
        err = _assert_repair_order_exists(session, body.repair_order_id)
        if err is not None:
            return err

    pk = uuid.uuid4()
    ddl = body.bid_deadline
    if ddl is not None and ddl.tzinfo is None:
        ddl = ddl.replace(tzinfo=timezone.utc)

    row = ProcurementProject(
        id=pk,
        title=body.title,
        summary=body.summary,
        repair_order_id=body.repair_order_id,
        status="OPEN",
        publisher_user_id=publisher_user_id,
        bid_deadline=ddl,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def list_projects(
    session: Session,
    *,
    status: str | None,
    page: int,
    page_size: int,
) -> tuple[list[ProcurementProject], int]:
    q = select(ProcurementProject)
    cnt_stmt = select(func.count(ProcurementProject.id)).select_from(ProcurementProject)
    if status and status.strip():
        st = status.strip()
        q = q.where(ProcurementProject.status == st)
        cnt_stmt = cnt_stmt.where(ProcurementProject.status == st)
    cnt = session.scalar(cnt_stmt) or 0
    rows = session.scalars(
        q.order_by(ProcurementProject.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), int(cnt)


def get_project(session: Session, project_id: UUID) -> ProcurementProject | None:
    return session.get(ProcurementProject, project_id)


def list_open_for_portal(session: Session, *, page: int, page_size: int) -> tuple[list[ProcurementProject], int]:
    return list_projects(session, status="OPEN", page=page, page_size=page_size)


def get_open_project_for_portal(session: Session, project_id: UUID) -> ProcurementProject | None:
    """门户详情：仅 OPEN 项目可见（口径同分页列表）。

    对齐 docs/06_接口设计/01 §三·4。
    """
    row = session.get(ProcurementProject, project_id)
    if row is None or row.status != "OPEN":
        return None
    return row


def apply_procurement_review(
    session: Session,
    project_id: UUID,
    reviewer_user_id: UUID,
    body: ProcurementProjectReviewBody,
) -> ProcurementProject | tuple[str, str]:
    """§三·6：OPEN 项目在首次审核后置为 CLOSED 或 CANCELLED，并记下审核者与备注。"""
    row = session.get(ProcurementProject, project_id)
    if row is None:
        return "not_found", "项目不存在"
    if row.status != "OPEN":
        return "conflict", "项目状态不允许再次审核流转"
    if body.decision == "CANCELLED" and body.winning_bid_id is not None:
        return "bad_request", "废止时不允许指定中选报价"

    winner: UUID | None = None
    if body.decision == "CLOSED" and body.winning_bid_id is not None:
        bid_row = session.get(ProcurementBid, body.winning_bid_id)
        if bid_row is None or bid_row.project_id != project_id:
            return "bad_bid", "中选报价不存在或不属于本项目"
        winner = bid_row.id

    row.status = "CLOSED" if body.decision == "CLOSED" else "CANCELLED"
    row.winning_bid_id = winner
    rmk = body.remark
    row.review_remark = rmk if rmk and rmk.strip() else None
    row.reviewed_at = datetime.now(timezone.utc)
    row.reviewer_user_id = reviewer_user_id
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def bid_to_api(
    *,
    bid: ProcurementBid,
    organization_legal_name: str,
    selected: bool = False,
) -> dict[str, Any]:
    qa = bid.quoted_amount
    qa_out: float | str
    try:
        qa_out = float(qa)
    except Exception:
        qa_out = str(qa)
    return {
        "id": bid.id,
        "project_id": bid.project_id,
        "organization_id": bid.organization_id,
        "organization_legal_name": organization_legal_name,
        "portal_account_id": bid.portal_account_id,
        "quoted_amount": qa_out,
        "currency": bid.currency,
        "remark": bid.remark,
        "selected": selected,
        "created_at": bid.created_at,
    }


def submit_bid_for_portal(
    session: Session,
    *,
    project_id: UUID,
    organization_id: UUID,
    portal_account_id: UUID,
    body: ProcurementBidCreate,
) -> ProcurementBid | tuple[str, str]:
    proj = session.get(ProcurementProject, project_id)
    if proj is None:
        return "not_found", "项目不存在"
    if proj.status != "OPEN":
        return "conflict", "项目当前不接受报价"

    pid = uuid.uuid4()
    row = ProcurementBid(
        id=pid,
        project_id=project_id,
        organization_id=organization_id,
        portal_account_id=portal_account_id,
        quoted_amount=body.quoted_amount,
        currency="CNY",
        remark=body.remark,
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return "conflict", "本企业已对该项目提交过报价"
    session.refresh(row)
    return row


def list_bids_for_project(session: Session, project_id: UUID) -> tuple[list[dict[str, Any]], str | None]:
    proj = session.get(ProcurementProject, project_id)
    if proj is None:
        return [], "not_found"
    stmt = (
        select(ProcurementBid, SupplierOrganization.legal_name)
        .join(SupplierOrganization, ProcurementBid.organization_id == SupplierOrganization.id)
        .where(ProcurementBid.project_id == project_id)
        .order_by(ProcurementBid.created_at.asc())
    )
    win = proj.winning_bid_id
    out: list[dict[str, Any]] = []
    for bid_row, legal in session.execute(stmt).all():
        out.append(
            bid_to_api(
                bid=bid_row,
                organization_legal_name=legal,
                selected=win is not None and bid_row.id == win,
            )
        )
    return out, None


def list_portal_org_bids_on_project(
    session: Session, *, project_id: UUID, organization_id: UUID
) -> tuple[list[dict[str, Any]], str | None]:
    """门户：本企业对指定竞价项目的报价（至多一条）。

    对齐 docs/06_接口设计/01 §三·5（读回）。
    """
    if session.get(ProcurementProject, project_id) is None:
        return [], "not_found"
    stmt = (
        select(ProcurementBid, SupplierOrganization.legal_name)
        .join(SupplierOrganization, ProcurementBid.organization_id == SupplierOrganization.id)
        .where(
            ProcurementBid.project_id == project_id,
            ProcurementBid.organization_id == organization_id,
        )
    )
    hit = session.execute(stmt).first()
    if hit is None:
        return [], None
    bid_row, legal = hit
    proj_row = session.get(ProcurementProject, project_id)
    win = proj_row.winning_bid_id if proj_row else None
    return [
        bid_to_api(
            bid=bid_row,
            organization_legal_name=legal,
            selected=win is not None and bid_row.id == win,
        )
    ], None
