"""报修维修业务逻辑。

对齐：docs/06_接口设计/01_API接口设计.md §二 · docs/03_数据库设计/04 §三
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.repair.models import (
    RepairAttachment,
    RepairOrder,
    RepairProcessRecord,
    RepairReport,
)
from app.modules.repair.schemas import (
    RepairAssignBody,
    RepairAttachmentRead,
    RepairClaimBody,
    RepairCompleteBody,
    RepairConfirmBody,
    RepairCreate,
    RepairDetailBundle,
    RepairOrderRead,
    RepairRecordCreate,
    RepairRecordRead,
    RepairReportRead,
)

PENDING_DISPATCH = "PENDING_DISPATCH"
ASSIGNED = "ASSIGNED"
IN_PROGRESS = "IN_PROGRESS"
AWAIT_CONFIRM = "AWAIT_CONFIRM"
CLOSED = "CLOSED"


def _normalize_page(page: int, page_size: int) -> tuple[int, int]:
    p = max(1, page)
    ps = min(100, max(1, page_size))
    return p, ps


def _gen_order_code() -> str:
    return f"RO{uuid.uuid4().hex[:16].upper()}"


def _get_order(session: Session, order_id: UUID) -> RepairOrder | None:
    return session.get(RepairOrder, order_id)


def assert_asset_exists(session: Session, asset_id: UUID) -> bool:
    row = session.get(Asset, asset_id)
    return row is not None and row.deleted_at is None


def create_repair(session: Session, body: RepairCreate) -> RepairOrderRead | None:
    if not assert_asset_exists(session, body.asset_id):
        return None
    for _ in range(5):
        order = RepairOrder(
            order_code=_gen_order_code(),
            asset_id=body.asset_id,
            report_department_id=body.report_department_id,
            reporter_id=body.reporter_id,
            reporter_name=body.reporter_name,
            reporter_phone=body.reporter_phone,
            fault_description=body.fault_description,
            fault_type=body.fault_type,
            fault_level=body.fault_level,
            priority=body.priority,
            order_status=PENDING_DISPATCH,
        )
        for att in body.attachments:
            order.attachments.append(
                RepairAttachment(
                    file_id=att.file_id,
                    file_type=att.file_type,
                    description=att.description,
                )
            )
        session.add(order)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            continue
        session.refresh(order)
        return RepairOrderRead.model_validate(order)
    return None


def _list_conditions(
    *,
    order_status: str | None = None,
    asset_id: UUID | None = None,
    department_id: UUID | None = None,
    assigned_engineer_id: UUID | None = None,
    priority: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list:
    conds: list = []
    if order_status:
        conds.append(RepairOrder.order_status == order_status)
    if asset_id:
        conds.append(RepairOrder.asset_id == asset_id)
    if department_id:
        conds.append(RepairOrder.report_department_id == department_id)
    if assigned_engineer_id:
        conds.append(RepairOrder.assigned_engineer_id == assigned_engineer_id)
    if priority:
        conds.append(RepairOrder.priority == priority)
    if date_from is not None:
        conds.append(func.date(RepairOrder.created_at) >= date_from)
    if date_to is not None:
        conds.append(func.date(RepairOrder.created_at) <= date_to)
    return conds


def list_repairs(
    session: Session,
    *,
    order_status: str | None = None,
    asset_id: UUID | None = None,
    department_id: UUID | None = None,
    assigned_engineer_id: UUID | None = None,
    priority: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[RepairOrderRead], int, int, int]:
    conds = _list_conditions(
        order_status=order_status,
        asset_id=asset_id,
        department_id=department_id,
        assigned_engineer_id=assigned_engineer_id,
        priority=priority,
        date_from=date_from,
        date_to=date_to,
    )
    stmt = select(RepairOrder)
    count_stmt = select(func.count()).select_from(RepairOrder)
    if conds:
        stmt = stmt.where(*conds)
        count_stmt = count_stmt.where(*conds)
    total = session.execute(count_stmt).scalar_one()

    stmt = stmt.order_by(RepairOrder.created_at.desc())
    page, page_size = _normalize_page(page, page_size)
    offset = (page - 1) * page_size
    rows = session.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return [RepairOrderRead.model_validate(r) for r in rows], int(total), page, page_size


def list_repair_summaries_for_asset(session: Session, asset_id: UUID, limit: int = 20) -> list[dict]:
    stmt = (
        select(RepairOrder)
        .where(RepairOrder.asset_id == asset_id)
        .order_by(RepairOrder.created_at.desc())
        .limit(min(100, max(1, limit)))
    )
    rows = session.execute(stmt).scalars().all()
    return [RepairOrderRead.model_validate(r).model_dump(mode="json") for r in rows]


def _record_to_read(row: RepairProcessRecord) -> RepairRecordRead:
    return RepairRecordRead(
        id=row.id,
        repair_order_id=row.repair_order_id,
        record_type=row.record_type,
        content=row.content,
        engineer_id=row.engineer_id,
        engineer_name=row.engineer_name,
        ai_assisted=row.ai_assisted,
        ai_result_id=row.ai_result_id,
        created_at=row.created_at,
        metadata=row.record_metadata,
    )


def detail_bundle(session: Session, order_id: UUID) -> RepairDetailBundle | None:
    order = _get_order(session, order_id)
    if order is None:
        return None
    atts = [
        RepairAttachmentRead.model_validate(a)
        for a in sorted(order.attachments, key=lambda x: x.uploaded_at)
    ]
    recs_rows: Sequence[RepairProcessRecord] = (
        session.execute(
            select(RepairProcessRecord)
            .where(RepairProcessRecord.repair_order_id == order.id)
            .order_by(RepairProcessRecord.created_at.asc())
        )
        .scalars()
        .all()
    )
    recs = [_record_to_read(r) for r in recs_rows]
    rep_model = session.execute(
        select(RepairReport).where(RepairReport.repair_order_id == order.id)
    ).scalar_one_or_none()
    report = RepairReportRead.model_validate(rep_model) if rep_model else None
    return RepairDetailBundle(
        order=RepairOrderRead.model_validate(order),
        attachments=atts,
        records=recs,
        report=report,
    )


def claim_repair(session: Session, order_id: UUID, body: RepairClaimBody) -> RepairOrderRead | tuple[str, str]:
    """成功返回 RepairOrderRead；失败返回 ('code', detail)。"""
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    if order.order_status != PENDING_DISPATCH:
        return "conflict", "当前状态不可抢单（仅待派工时开放）"
    if order.assigned_engineer_id is not None:
        return "conflict", "工单已被指派"
    now = datetime.now(UTC)
    order.assigned_engineer_id = body.engineer_id
    order.order_status = ASSIGNED
    order.accepted_at = now if order.accepted_at is None else order.accepted_at
    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)


def assign_repair(session: Session, order_id: UUID, body: RepairAssignBody) -> RepairOrderRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    if order.order_status not in (PENDING_DISPATCH, ASSIGNED):
        return "conflict", "当前状态不可改派"

    meta = []
    if body.reason:
        meta.append(f"[派单原因] {body.reason}")

    now = datetime.now(UTC)
    order.assigned_engineer_id = body.engineer_id
    order.order_status = ASSIGNED
    order.accepted_at = order.accepted_at or now

    note = RepairProcessRecord(
        repair_order_id=order.id,
        record_type="ASSIGN",
        content="\n".join(meta) if meta else "强制派单",
        engineer_id=body.engineer_id,
        record_metadata={"forced": True, "reason": body.reason},
    )
    session.add(note)
    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)


def add_process_record(session: Session, order_id: UUID, body: RepairRecordCreate) -> RepairRecordRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    if order.order_status not in (ASSIGNED, IN_PROGRESS):
        return "conflict", "当前状态不可登记过程记录"
    if order.order_status == ASSIGNED:
        order.order_status = IN_PROGRESS
    row = RepairProcessRecord(
        repair_order_id=order.id,
        record_type=body.record_type,
        content=body.content,
        engineer_id=body.engineer_id,
        engineer_name=body.engineer_name,
    )
    session.add(row)
    session.add(order)
    session.commit()
    session.refresh(row)
    return _record_to_read(row)


def complete_repair(session: Session, order_id: UUID, body: RepairCompleteBody) -> RepairOrderRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    if order.order_status not in (ASSIGNED, IN_PROGRESS):
        return "conflict", "当前状态不可结案为待科室确认"

    now = datetime.now(UTC)
    existing = session.execute(
        select(RepairReport).where(RepairReport.repair_order_id == order.id)
    ).scalar_one_or_none()
    if existing is None:
        rep = RepairReport(
            repair_order_id=order.id,
            fault_cause=body.fault_cause,
            repair_method=body.repair_method,
            replaced_parts=body.replaced_parts,
            test_result=body.test_result,
            conclusion=body.conclusion,
        )
        session.add(rep)
    else:
        existing.fault_cause = body.fault_cause if body.fault_cause is not None else existing.fault_cause
        existing.repair_method = body.repair_method if body.repair_method is not None else existing.repair_method
        existing.replaced_parts = body.replaced_parts if body.replaced_parts is not None else existing.replaced_parts
        existing.test_result = body.test_result if body.test_result is not None else existing.test_result
        existing.conclusion = body.conclusion if body.conclusion is not None else existing.conclusion
        session.add(existing)

    if body.actual_cost is not None:
        order.actual_cost = body.actual_cost

    order.order_status = AWAIT_CONFIRM
    order.completed_at = now

    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)


def confirm_repair(session: Session, order_id: UUID, body: RepairConfirmBody) -> RepairOrderRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    if order.order_status != AWAIT_CONFIRM:
        return "conflict", "仅待科室确认状态可签收"

    now = datetime.now(UTC)
    rep = session.execute(
        select(RepairReport).where(RepairReport.repair_order_id == order.id)
    ).scalar_one_or_none()

    confirm_status = body.confirm_status
    dept_comment = body.comment or ""

    if rep is None:
        rep = RepairReport(
            repair_order_id=order.id,
            department_confirm_status=confirm_status,
            department_confirm_by=body.department_confirm_by,
            department_confirm_at=now,
            conclusion=dept_comment or None,
        )
        session.add(rep)
    else:
        rep.department_confirm_status = confirm_status
        if body.department_confirm_by is not None:
            rep.department_confirm_by = body.department_confirm_by
        rep.department_confirm_at = now
        if dept_comment:
            rep.conclusion = (rep.conclusion or "") + ("\n科室意见：" + dept_comment)
        session.add(rep)

    order.confirmed_at = now
    if confirm_status == "ACCEPTED":
        order.order_status = CLOSED
    else:
        order.order_status = IN_PROGRESS

    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)


def set_outsourced(session: Session, order_id: UUID) -> RepairOrderRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    order.is_outsourced = True
    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)


def set_return_factory(session: Session, order_id: UUID) -> RepairOrderRead | tuple[str, str]:
    order = _get_order(session, order_id)
    if order is None:
        return "not_found", "工单不存在"
    order.is_return_factory = True
    session.add(order)
    session.commit()
    session.refresh(order)
    return RepairOrderRead.model_validate(order)
