"""财务 HTTP API（发票 / 应付 / 付款 / 账龄 / 付款优先级 AI）。

对齐：docs/06_接口设计/01 §五（**e014** invoice、**e015** payable/payment）。
已连 PG 但未建相关表时：各路由捕获 **SQLAlchemyError** 并返回 **503**（`_FINANCE_PG_NOT_READY`）。
"""

from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.integrations.minio_client import put_object_bytes
from app.modules.ai.schemas import AiResultReviewBody
from app.modules.ai import service as ai_service
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import (
    RBAC_FINANCE_PAY,
    RBAC_FINANCE_READ,
    RBAC_FINANCE_REVIEW,
    RBAC_FINANCE_UPLOAD,
)
from app.modules.auth.schemas import JwtClaims
from app.modules.finance import service as fi_svc
from app.modules.finance.schemas import PayableCreateBody, PaymentPriorityBody, PaymentRegisterBody


router = APIRouter(prefix="/finance", tags=["finance"])

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _ensure_pg_finance() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="财务模块需在 PostgreSQL 执行 `alembic upgrade head`（含 e014 finance.invoice、e015 payable/payment）后使用。",
        )


PgFinanceStore = Depends(_ensure_pg_finance)

_FINANCE_PG_NOT_READY = (
    "财务持久化未就绪：请在目标库执行 alembic upgrade head（含 e014 invoice、e015 payable/payment）。"
)


@router.get("", summary="模块信息（兼容早期占位契约）")
def finance_root() -> dict[str, object]:
    return envelope_ok(
        data={
            "module": "finance",
            "name": "发票付款",
            "paths": {
                "invoices_upload": "/api/v1/finance/invoices/upload",
                "invoices": "/api/v1/finance/invoices",
                "payables": "/api/v1/finance/payables",
                "payments": "/api/v1/finance/payments",
                "aging_analysis": "/api/v1/finance/aging-analysis",
                "payment_priority_ai": "/api/v1/finance/payment-priority/ai-analyze",
            },
            "supplier_portal_mirror": {
                "invoices": "/api/v1/supplier-portal/invoices",
                "payables": "/api/v1/supplier-portal/payables",
                "payments": "/api/v1/supplier-portal/payments",
            },
        }
    )


@router.post("/invoices/upload", dependencies=[PgFinanceStore])
async def finance_invoice_upload(
    db: DbSession,
    organization_id: UUID = Form(..., description="供应商主体 organization_id"),
    file: UploadFile = File(...),
    actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_UPLOAD)),
) -> dict:
    """§五·1：上传发票文件并入库，同步创建 OCR（`INVOICE_OCR`）占位 AI 任务与结果。"""
    if not file.filename or not str(file.filename).strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件名无效")

    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="单文件不得超过 25MB")

    safe_name = "".join(ch for ch in file.filename if ch.isalnum() or ch in "._-")[:128] or "upload"
    object_key = f"finance/invoice/{organization_id}/{uuid.uuid4().hex}_{safe_name}"
    mime = file.content_type or "application/octet-stream"
    fsize = len(raw)
    try:
        put_object_bytes(object_key=object_key, data=raw, content_type=mime)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MinIO 写入失败：{exc!s}",
        ) from exc

    try:
        out = fi_svc.create_invoice_upload(
            db,
            organization_id=organization_id,
            uploaded_by_user_id=actor.sub,
            object_key=object_key,
            mime_type=mime,
            file_size=fsize,
        )
        if isinstance(out, tuple):
            _code, msg = out
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        row = out
        emit_audit(
            db,
            actor,
            action="FINANCE_INVOICE_UPLOAD",
            object_type="finance_invoice",
            object_id=row.id,
            after_data={
                "organization_id": str(organization_id),
                "ai_task_id": str(row.ai_task_id) if row.ai_task_id else None,
                "ai_result_id": str(row.ai_result_id) if row.ai_result_id else None,
            },
        )
        ocr_status = fi_svc.get_invoice_ocr_status(db, row)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(
        data={**fi_svc.invoice_to_detail(row), "ocr_review_status": ocr_status}
    )


@router.get("/invoices", dependencies=[PgFinanceStore])
def finance_invoice_list(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
    organization_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§五·2"""
    try:
        rows, total = fi_svc.list_invoices(
            db, organization_id=organization_id, page=page, page_size=page_size
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    items = [
        fi_svc.invoice_to_summary(inv, ocr_review_status=st) for inv, st in rows
    ]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/invoices/{invoice_id}", dependencies=[PgFinanceStore])
def finance_invoice_detail(
    db: DbSession,
    invoice_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
) -> dict:
    """§五·3"""
    try:
        row = fi_svc.get_invoice(db, invoice_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="发票不存在")
        ocr_status = fi_svc.get_invoice_ocr_status(db, row)
        detail = fi_svc.invoice_to_detail(row)
        detail["ocr_review_status"] = ocr_status
        if row.ai_result_id:
            rst = ai_service.get_result_detail(db, row.ai_result_id)
            if rst is not None:
                detail["ocr_result"] = ai_service.result_to_read(rst)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=detail)


@router.post("/invoices/{invoice_id}/review", dependencies=[PgFinanceStore])
def finance_invoice_review_ai(
    db: DbSession,
    invoice_id: UUID,
    body: AiResultReviewBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_REVIEW)),
) -> dict:
    """§五·4：人工确认本条发票关联的发票 OCR 占位结果。"""
    try:
        raw = fi_svc.confirm_invoice_ai_result(db, invoice_id, body, actor.sub)
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            if code == "no_result":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        reviewed = raw
        emit_audit(
            db,
            actor,
            action="FINANCE_INVOICE_OCR_REVIEW",
            object_type="finance_invoice",
            object_id=invoice_id,
            after_data={"ai_result_id": str(reviewed.id), "review_status": reviewed.review_status},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=ai_service.result_to_read(reviewed))


@router.get("/payables", dependencies=[PgFinanceStore])
def finance_list_payables(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
    supplier_id: UUID | None = Query(None, description="同 supplier.organization_id"),
    organization_id: UUID | None = Query(None, description="与 supplier_id 等价，任选其一"),
    payable_status: str | None = Query(
        None, alias="status", description="OPEN/CLOSED 或 ALL（默认不过滤）"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§五·5"""
    org = supplier_id or organization_id
    try:
        rows, total = fi_svc.list_payables(
            db,
            organization_id=org,
            status=payable_status,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    items = [fi_svc.payable_to_summary(r) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.post("/payables", dependencies=[PgFinanceStore])
def finance_create_payable(
    db: DbSession,
    actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_PAY)),
    body: PayableCreateBody = Body(...),
) -> dict:
    """院内补录应付款台账（与 GET /payables 数据源一致；权限同登记付款）。"""
    try:
        raw = fi_svc.create_payable(db, body)
        if isinstance(raw, tuple):
            _code, msg = raw
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        row = raw
        emit_audit(
            db,
            actor,
            action="FINANCE_PAYABLE_CREATE",
            object_type="finance_payable",
            object_id=row.id,
            after_data={"organization_id": str(row.organization_id), "amount_due": str(row.amount_due)},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=fi_svc.payable_to_summary(row))


@router.get("/payables/{payable_id}", dependencies=[PgFinanceStore])
def finance_payable_detail(
    db: DbSession,
    payable_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
) -> dict:
    """§五·5.2 单条应付台账。"""
    try:
        row = fi_svc.get_payable(db, payable_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应付款台账不存在")
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=fi_svc.payable_to_summary(row))


@router.get("/payments", dependencies=[PgFinanceStore])
def finance_list_payments(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
    supplier_id: UUID | None = Query(None),
    organization_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§五·6.1 院内付款登记分页；可选按供应商筛选。"""
    org = supplier_id or organization_id
    try:
        rows, total = fi_svc.list_payments_filtered(
            db, organization_id=org, page=page, page_size=page_size
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    items = [fi_svc.payment_to_read(db, r) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/payments/{payment_id}", dependencies=[PgFinanceStore])
def finance_payment_detail(
    db: DbSession,
    payment_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
) -> dict:
    """§五·6.2 单条付款登记（含分摊）。"""
    try:
        row = fi_svc.get_payment(db, payment_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="付款登记不存在")
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=fi_svc.payment_to_read(db, row))


@router.post("/payments", dependencies=[PgFinanceStore])
def finance_register_payment(
    db: DbSession,
    actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_PAY)),
    body: PaymentRegisterBody = Body(...),
) -> dict:
    """§五·6：登记付款并核销 invoice / payable。"""
    try:
        raw = fi_svc.register_payment(db, body, actor.sub)
        if isinstance(raw, tuple):
            code, msg = raw
            if code in ("supplier_not_found", "not_found"):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            if code == "allocation_mismatch":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        row = raw
        emit_audit(
            db,
            actor,
            action="FINANCE_PAYMENT_REGISTER",
            object_type="finance_payment",
            object_id=row.id,
            after_data={"supplier_id": str(body.supplier_id), "payment_amount": str(body.payment_amount)},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=fi_svc.payment_to_read(db, row))


@router.get("/aging-analysis", dependencies=[PgFinanceStore])
def finance_aging_analysis(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
    supplier_id: UUID | None = Query(None),
    organization_id: UUID | None = Query(None),
) -> dict:
    """§五·7"""
    org = supplier_id or organization_id
    try:
        data = fi_svc.aging_analysis(db, organization_id=org)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(data=data)


@router.post("/payment-priority/ai-analyze", dependencies=[PgFinanceStore])
def finance_payment_priority_ai_analyze(
    db: DbSession,
    actor: JwtClaims = Depends(require_roles(*RBAC_FINANCE_READ)),
    body: PaymentPriorityBody | None = Body(default=None),
) -> dict:
    """§五·8：付款优先级占位分析（对齐 §六 PAYMENT_PRIORITY）。"""
    eff = body if body is not None else PaymentPriorityBody()
    try:
        task, result = fi_svc.run_payment_priority_ai(
            db, recorded_by_user_id=actor.sub, supplier_id=eff.supplier_id
        )
        emit_audit(
            db,
            actor,
            action="FINANCE_PAYMENT_PRIORITY_AI",
            object_type="ai_task",
            object_id=task.id,
            after_data={
                "result_id": str(result.id),
                "supplier_filter": str(eff.supplier_id) if eff.supplier_id else None,
            },
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_FINANCE_PG_NOT_READY
        ) from exc
    return envelope_ok(
        data={"task": ai_service.task_to_read(task), "result": ai_service.result_to_read(result)}
    )
