"""院内发票、应付款、付款登记与账龄（PostgreSQL / e014+e015）。

对齐 docs/06_接口设计/01 §五。
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.modules.ai import service as ai_service
from app.modules.ai.models import AiResult, AiTask
from app.modules.ai.schemas import AiResultReviewBody
from app.modules.finance.models import Invoice, Payable, Payment, PaymentAllocation
from app.modules.finance.schemas import PayableCreateBody, PaymentRegisterBody
from app.modules.supplier_portal.models import SupplierOrganization

Q2 = Decimal("0.01")


def q2(x: Decimal) -> Decimal:
    return x.quantize(Q2, rounding=ROUND_HALF_UP)

def invoice_to_summary(row: Invoice, *, ocr_review_status: str | None) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "uploaded_by_user_id": row.uploaded_by_user_id,
        "object_key": row.object_key,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "ai_task_id": row.ai_task_id,
        "ai_result_id": row.ai_result_id,
        "ocr_review_status": ocr_review_status,
        "created_at": row.created_at,
    }


def invoice_to_detail(row: Invoice) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "uploaded_by_user_id": row.uploaded_by_user_id,
        "object_key": row.object_key,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "ai_task_id": row.ai_task_id,
        "ai_result_id": row.ai_result_id,
        "created_at": row.created_at,
    }


def create_invoice_upload(
    session: Session,
    *,
    organization_id: UUID,
    uploaded_by_user_id: UUID,
    object_key: str,
    mime_type: str | None,
    file_size: int | None,
) -> Invoice | tuple[str, str]:
    if session.get(SupplierOrganization, organization_id) is None:
        return "not_found", "供应商主体不存在"

    pk = uuid.uuid4()
    task, result = ai_service.create_ai_task_stub(
        session,
        task_type="INVOICE_OCR",
        payload={"invoice_id": str(pk), "object_key": object_key},
        created_by_user_id=uploaded_by_user_id,
        autocommit=False,
    )

    row = Invoice(
        id=pk,
        organization_id=organization_id,
        uploaded_by_user_id=uploaded_by_user_id,
        object_key=object_key,
        mime_type=mime_type,
        file_size=file_size,
        ai_task_id=task.id,
        ai_result_id=result.id,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def list_invoices(
    session: Session,
    *,
    organization_id: UUID | None,
    page: int,
    page_size: int,
) -> tuple[list[tuple[Invoice, str | None]], int]:
    stmt = (
        select(Invoice, AiResult.review_status)
        .outerjoin(AiResult, AiResult.id == Invoice.ai_result_id)
        .order_by(Invoice.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    cnt_stmt = select(func.count(Invoice.id)).select_from(Invoice)
    if organization_id is not None:
        stmt = stmt.where(Invoice.organization_id == organization_id)
        cnt_stmt = cnt_stmt.where(Invoice.organization_id == organization_id)

    cnt = session.scalar(cnt_stmt) or 0
    hits = session.execute(stmt).all()
    return [(inv, rst) for inv, rst in hits], int(cnt)


def get_invoice(session: Session, invoice_id: UUID) -> Invoice | None:
    return session.get(Invoice, invoice_id)


def get_invoice_ocr_status(session: Session, invoice: Invoice) -> str | None:
    if invoice.ai_result_id is None:
        return None
    rst = session.get(AiResult, invoice.ai_result_id)
    return rst.review_status if rst else None


def confirm_invoice_ai_result(
    session: Session,
    invoice_id: UUID,
    body: AiResultReviewBody,
    reviewer_user_id: UUID,
) -> AiResult | tuple[str, str]:
    """§五·4：对发票关联的 OCR AI 占位结果做一次人工确认（写回 ai.ai_result）。"""
    inv = session.get(Invoice, invoice_id)
    if inv is None:
        return "not_found", "发票不存在"
    if inv.ai_result_id is None:
        return "no_result", "未关联 OCR 识别结果"

    reviewed = ai_service.review_result(session, inv.ai_result_id, body, reviewer_user_id)
    if reviewed is None:
        return "not_found", "识别结果不存在"
    return reviewed


def payable_to_summary(row: Payable) -> dict[str, Any]:
    bal = q2(row.amount_due - row.amount_paid)
    return {
        "id": row.id,
        "supplier_id": row.organization_id,
        "organization_id": row.organization_id,
        "title": row.title,
        "amount_due": float(row.amount_due),
        "amount_paid": float(row.amount_paid),
        "balance": float(bal),
        "due_date": row.due_date.isoformat() if row.due_date else None,
        "status": row.status,
        "created_at": row.created_at,
    }


def payable_to_portal_public(row: Payable) -> dict[str, Any]:
    """§四·5：门户应付视图（不暴露与 `organization_id` 重复的 `supplier_id` 字段名）。"""
    s = payable_to_summary(row)
    s.pop("supplier_id", None)
    return s


def list_payables(
    session: Session,
    *,
    organization_id: UUID | None,
    status: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Payable], int]:
    """§五·5"""
    parts: list[Any] = []
    if organization_id is not None:
        parts.append(Payable.organization_id == organization_id)
    if status is not None and str(status).upper() != "ALL":
        parts.append(Payable.status == str(status).upper())
    stmt = (
        select(Payable)
        .order_by(Payable.due_date.asc().nulls_last(), Payable.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    cnt_stmt = select(func.count(Payable.id)).select_from(Payable)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    cnt = session.scalar(cnt_stmt) or 0
    rows = session.scalars(stmt).all()
    return list(rows), int(cnt)


def get_payable(session: Session, payable_id: UUID) -> Payable | None:
    return session.get(Payable, payable_id)


def list_payments_filtered(
    session: Session,
    *,
    organization_id: UUID | None,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    """院内付款台账分页；`organization_id` 为空表示不做供应商过滤。"""
    parts: list[Any] = []
    if organization_id is not None:
        parts.append(Payment.organization_id == organization_id)
    stmt = (
        select(Payment)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    cnt_stmt = select(func.count(Payment.id)).select_from(Payment)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    cnt = session.scalar(cnt_stmt) or 0
    rows = session.scalars(stmt).all()
    return list(rows), int(cnt)


def get_payment(session: Session, payment_id: UUID) -> Payment | None:
    return session.get(Payment, payment_id)


def create_payable(session: Session, body: PayableCreateBody) -> Payable | tuple[Literal["not_found"], str]:
    """院内补录应付款台账行（OPEN，已付 0）。"""
    oid = body.resolved_organization_id
    if session.get(SupplierOrganization, oid) is None:
        return "not_found", "供应商不存在"
    row = Payable(
        id=uuid.uuid4(),
        organization_id=oid,
        title=body.title.strip(),
        amount_due=q2(body.amount_due),
        amount_paid=Decimal("0"),
        due_date=body.due_date,
        status="OPEN",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def register_payment(
    session: Session,
    body: PaymentRegisterBody,
    recorded_by_user_id: UUID,
) -> Payment | tuple[Literal["supplier_not_found", "allocation_mismatch", "not_found", "wrong_org"], str]:
    """§五·6：单笔付款核销；核销应付行时递增 `payable.amount_paid`。"""
    oid = body.supplier_id
    if session.get(SupplierOrganization, oid) is None:
        return "supplier_not_found", "供应商不存在"

    pay_amt = q2(body.payment_amount)
    total_alloc = q2(sum(q2(a.allocated_amount) for a in body.allocations))
    if total_alloc != pay_amt:
        return "allocation_mismatch", "allocations 合计须等于 payment_amount"

    staged: list[tuple[Literal["invoice", "payable"], UUID | Payable, Decimal]] = []
    for a in body.allocations:
        amt = q2(a.allocated_amount)
        if a.invoice_id is not None:
            inv = session.get(Invoice, a.invoice_id)
            if inv is None:
                return "not_found", "发票不存在"
            if inv.organization_id != oid:
                return "wrong_org", "invoice_id 与 supplier_id 不匹配"
            staged.append(("invoice", a.invoice_id, amt))
        else:
            py = session.get(Payable, a.payable_id)
            if py is None:
                return "not_found", "应付款台账行不存在"
            if py.organization_id != oid:
                return "wrong_org", "payable_id 与 supplier_id 不匹配"
            staged.append(("payable", py, amt))

    pay = Payment(
        id=uuid.uuid4(),
        organization_id=oid,
        recorded_by_user_id=recorded_by_user_id,
        payment_amount=pay_amt,
        payment_date=body.payment_date,
    )
    session.add(pay)
    session.flush()

    for kind, target, amt in staged:
        if kind == "invoice":
            inv_uid = target
            assert isinstance(inv_uid, UUID)
            pa = PaymentAllocation(
                id=uuid.uuid4(),
                payment_id=pay.id,
                invoice_id=inv_uid,
                payable_id=None,
                allocated_amount=amt,
            )
            session.add(pa)
        else:
            assert isinstance(target, Payable)
            pa = PaymentAllocation(
                id=uuid.uuid4(),
                payment_id=pay.id,
                invoice_id=None,
                payable_id=target.id,
                allocated_amount=amt,
            )
            session.add(pa)
            target.amount_paid = q2(target.amount_paid + amt)
            if target.amount_paid >= target.amount_due:
                target.status = "CLOSED"
            else:
                target.status = "OPEN"
            session.add(target)

    session.commit()
    session.refresh(pay)
    return pay


def list_payment_allocations(session: Session, payment_id: UUID) -> list[PaymentAllocation]:
    return list(
        session.scalars(select(PaymentAllocation).where(PaymentAllocation.payment_id == payment_id)).all()
    )


def payment_to_read(session: Session, row: Payment) -> dict[str, Any]:
    allocs = list_payment_allocations(session, row.id)
    items = []
    for pa in allocs:
        items.append(
            {
                "id": pa.id,
                "invoice_id": pa.invoice_id,
                "payable_id": pa.payable_id,
                "allocated_amount": float(pa.allocated_amount),
            }
        )
    return {
        "id": row.id,
        "supplier_id": row.organization_id,
        "payment_amount": float(row.payment_amount),
        "payment_date": row.payment_date.isoformat(),
        "recorded_by_user_id": row.recorded_by_user_id,
        "allocations": items,
        "created_at": row.created_at,
    }


def list_payments_for_organization(
    session: Session,
    *,
    organization_id: UUID,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    """§四·7：院内登记的本供应商付款核销记录分页。"""
    return list_payments_filtered(session, organization_id=organization_id, page=page, page_size=page_size)


def payment_to_portal_public(session: Session, row: Payment) -> dict[str, Any]:
    """门户视图：不向供应商暴露 `recorded_by_user_id`。"""
    allocs = list_payment_allocations(session, row.id)
    alloc_items = [
        {
            "invoice_id": pa.invoice_id,
            "payable_id": pa.payable_id,
            "allocated_amount": float(pa.allocated_amount),
        }
        for pa in allocs
    ]
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "payment_amount": float(row.payment_amount),
        "payment_date": row.payment_date.isoformat(),
        "allocations": alloc_items,
        "created_at": row.created_at,
    }


def aging_analysis(session: Session, *, organization_id: UUID | None) -> dict[str, Any]:
    """§五·7：按仍未结清的 payable 近似账龄分布。"""
    stmt = select(Payable).where(Payable.amount_due > Payable.amount_paid)
    if organization_id is not None:
        stmt = stmt.where(Payable.organization_id == organization_id)
    rows = list(session.scalars(stmt).all())
    today = date.today()
    tmpl: dict[str, dict[str, Any]] = {
        "NO_DUE_DATE": {"code": "NO_DUE_DATE", "label": "无约定到期日", "open_count": 0, "amount": Decimal("0")},
        "CURRENT": {"code": "CURRENT", "label": "未到期", "open_count": 0, "amount": Decimal("0")},
        "D1_30": {"code": "D1_30", "label": "逾期1-30天", "open_count": 0, "amount": Decimal("0")},
        "D31_60": {"code": "D31_60", "label": "逾期31-60天", "open_count": 0, "amount": Decimal("0")},
        "D61_90": {"code": "D61_90", "label": "逾期61-90天", "open_count": 0, "amount": Decimal("0")},
        "D90_PLUS": {"code": "D90_PLUS", "label": "逾期90天以上", "open_count": 0, "amount": Decimal("0")},
    }
    open_total = Decimal("0")
    open_count = 0
    for p in rows:
        bal = q2(p.amount_due - p.amount_paid)
        if bal <= 0:
            continue
        open_count += 1
        open_total = q2(open_total + bal)
        due = p.due_date
        if due is None:
            key = "NO_DUE_DATE"
        elif due > today:
            key = "CURRENT"
        else:
            od = (today - due).days
            if od <= 30:
                key = "D1_30"
            elif od <= 60:
                key = "D31_60"
            elif od <= 90:
                key = "D61_90"
            else:
                key = "D90_PLUS"
        tmpl[key]["open_count"] += 1
        tmpl[key]["amount"] = q2(tmpl[key]["amount"] + bal)

    bucket_list = []
    for b in tmpl.values():
        bucket_list.append(
            {
                "code": b["code"],
                "label": b["label"],
                "open_count": b["open_count"],
                "amount": float(q2(b["amount"])),
            }
        )
    return {
        "as_of": today.isoformat(),
        "open_count": open_count,
        "open_total": float(q2(open_total)),
        "buckets": bucket_list,
    }


def build_payment_priority_suggestions(session: Session, supplier_id: UUID | None) -> list[dict[str, Any]]:
    stmt = select(Payable).where(Payable.amount_due > Payable.amount_paid)
    if supplier_id is not None:
        stmt = stmt.where(Payable.organization_id == supplier_id)
    rows = list(session.scalars(stmt).all())

    def _key(p: Payable) -> tuple[int, date, Decimal]:
        bal = q2(p.amount_due - p.amount_paid)
        if p.due_date is None:
            return (1, date.max, -bal)
        return (0, p.due_date, -bal)

    rows.sort(key=_key)
    out: list[dict[str, Any]] = []
    for i, p in enumerate(rows, start=1):
        bal = q2(p.amount_due - p.amount_paid)
        out.append(
            {
                "rank": i,
                "payable_id": str(p.id),
                "supplier_id": str(p.organization_id),
                "balance": float(bal),
                "due_date": p.due_date.isoformat() if p.due_date else None,
                "reason": "占位规则：到期日优先（未到期的置后），同日按余额从高到低",
            }
        )
    return out


def run_payment_priority_ai(
    session: Session,
    *,
    recorded_by_user_id: UUID,
    supplier_id: UUID | None,
) -> tuple[AiTask, AiResult]:
    """§五·8：创建 PAYMENT_PRIORITY 占位任务并把排序建议写入 ai_result.output_payload。"""
    suggestions = build_payment_priority_suggestions(session, supplier_id)
    payload: dict[str, Any] = {
        "supplier_filter": str(supplier_id) if supplier_id else None,
        "rule": "due_date_asc_then_balance_desc",
        "candidate_count": len(suggestions),
    }
    task, result = ai_service.create_ai_task_stub(
        session,
        task_type="PAYMENT_PRIORITY",
        payload=payload,
        created_by_user_id=recorded_by_user_id,
        autocommit=False,
    )
    merged = dict(result.output_payload or {})
    merged["priority_suggestions"] = suggestions
    merged["ranked_payable_ids"] = [x["payable_id"] for x in suggestions]
    result.output_payload = merged
    session.add(result)
    session.commit()
    session.refresh(task)
    session.refresh(result)
    return task, result


def unpaid_balance_for_organization(session: Session, organization_id: UUID) -> Decimal:
    """门户 dashboard：未核销应付余额之和（不得低于 0）。"""
    rows = session.scalars(select(Payable).where(Payable.organization_id == organization_id)).all()
    s = Decimal("0")
    for p in rows:
        bal = q2(p.amount_due - p.amount_paid)
        if bal > 0:
            s = q2(s + bal)
    return s


def paid_total_for_organization(session: Session, organization_id: UUID) -> Decimal:
    raw = session.scalar(
        select(func.coalesce(func.sum(Payment.payment_amount), 0)).where(Payment.organization_id == organization_id)
    )
    if raw is None:
        return Decimal("0")
    return q2(Decimal(str(raw)))
