"""供应商门户 HTTP API。

对齐：docs/06_接口设计/01_API接口设计.md §四；竞价项目发布与院内审核仍以管理端 `/supplier-projects` 等为后续。
已连 PG 但未建相关表时：各路由捕获 **SQLAlchemyError** 并返回 **503**（`_PORTAL_SQL_NOT_READY`）。
"""

from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.integrations.minio_client import put_object_bytes
from app.modules.auth.schemas import JwtClaims
from app.modules.supplier_portal.deps import SupplierPortalAccountDep
from app.modules.supplier_portal.models import SupplierOrganization, SupplierPortalAccount
from app.modules.ai import service as ai_service
from app.modules.supplier_portal.schemas import SupplierLoginRequest
from app.modules.supplier_portal import service as sp_svc
from app.modules.supplier_projects import service as pr_svc
from app.modules.supplier_projects.schemas import ProcurementBidCreate
from app.modules.finance import service as fin_svc

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

_PORTAL_SQL_NOT_READY = (
    "供应商门户依赖的库表未就绪：请在目标库执行 alembic upgrade head（e009、e010–e013、e014–e015、e016 等）。"
)


def _ensure_pg_supplier_portal() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="供应商门户需在 PostgreSQL 执行 `alembic upgrade head`（含 e009、e016 资质审核列、e014–e015 发票/应付、竞价 e010–e013）后使用。",
        )


router = APIRouter(
    prefix="/supplier-portal",
    tags=["supplier-portal"],
    dependencies=[Depends(_ensure_pg_supplier_portal)],
)


def _portal_claims(account: SupplierPortalAccount) -> JwtClaims:
    return JwtClaims(sub=account.id, username=account.username, roles=frozenset({"SUPPLIER"}))


@router.post("/auth/login")
def supplier_portal_login(db: DbSession, body: SupplierLoginRequest) -> dict:
    """§四·1 供应商门户独立登录签 JWT（角色 SUPPLIER）。"""
    try:
        tok = sp_svc.authenticate_portal(db, body.username, body.password)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    if tok is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    return envelope_ok(data=tok.model_dump(mode="json"))


@router.get("/dashboard")
def supplier_dashboard(db: DbSession, account: SupplierPortalAccountDep) -> dict:
    """§四·2：应付/发票/资质待补等汇总（`missing_material_count` 见 `dashboard_snapshot` 规则）。"""
    try:
        data = sp_svc.dashboard_snapshot(db, organization_id=account.organization_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(data=data)


@router.get("/projects")
def supplier_projects_list(
    db: DbSession,
    _account: SupplierPortalAccountDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§三·4：浏览院内已发布且仍为 OPEN 的竞价项目。"""
    try:
        rows, total = pr_svc.list_open_for_portal(db, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(
        data={"items": [pr_svc.row_to_portal(r) for r in rows], "total": total, "page": page, "page_size": page_size}
    )


@router.get("/projects/{project_id}")
def supplier_project_detail(
    db: DbSession,
    project_id: UUID,
    _account: SupplierPortalAccountDep,
) -> dict:
    """门户查看单个仍在报名中的竞价项目（与分页列表同属 §三·4 口径）；已收官或不存在返回 404。"""
    try:
        row = pr_svc.get_open_project_for_portal(db, project_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在或已结束")
    return envelope_ok(data=pr_svc.row_to_portal(row))


@router.get("/projects/{project_id}/bids")
def supplier_list_own_procurement_bids(
    db: DbSession,
    project_id: UUID,
    account: SupplierPortalAccountDep,
) -> dict:
    """本单位已提交的报价条目（至多一条）；项目不存在返回 404。"""
    try:
        items, err = pr_svc.list_portal_org_bids_on_project(
            db, project_id=project_id, organization_id=account.organization_id
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    if err == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return envelope_ok(data={"items": items, "total": len(items)})


@router.post("/projects/{project_id}/bids")
def supplier_submit_procurement_bid(
    db: DbSession,
    project_id: UUID,
    account: SupplierPortalAccountDep,
    body: ProcurementBidCreate,
) -> dict:
    """§三·5"""
    try:
        raw = pr_svc.submit_bid_for_portal(
            db,
            project_id=project_id,
            organization_id=account.organization_id,
            portal_account_id=account.id,
            body=body,
        )
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        bid = raw
        org = db.get(SupplierOrganization, account.organization_id)
        legal = org.legal_name if org is not None else ""
        emit_audit(
            db,
            _portal_claims(account),
            action="PROCUREMENT_BID_SUBMIT",
            object_type="procurement_bid",
            object_id=bid.id,
            after_data={
                "project_id": str(project_id),
                "quoted_amount": str(bid.quoted_amount),
                "organization_id": str(account.organization_id),
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(data=pr_svc.bid_to_api(bid=bid, organization_legal_name=legal))


@router.get("/qualifications")
def supplier_qualifications_list(
    db: DbSession,
    account: SupplierPortalAccountDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = sp_svc.list_qualifications(
            db, organization_id=account.organization_id, page=page, page_size=page_size
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(
        data={"items": [sp_svc.qual_to_api(r) for r in rows], "total": total, "page": page, "page_size": page_size}
    )


@router.get("/qualifications/{qualification_id}")
def supplier_qualification_detail(
    db: DbSession,
    account: SupplierPortalAccountDep,
    qualification_id: UUID,
) -> dict:
    """§四·4：与列表单行结构一致；非本企业或未找到 404。"""
    try:
        row = sp_svc.get_qualification_for_portal(
            db, qualification_id, organization_id=account.organization_id
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资质不存在")
    return envelope_ok(data=sp_svc.qual_to_api(row))


@router.post("/qualifications")
async def supplier_qualifications_create(
    db: DbSession,
    account: SupplierPortalAccountDep,
    title: str = Form(..., min_length=1, max_length=512),
    credential_type: str | None = Form(default=None, max_length=64),
    file: UploadFile | None = File(None),
) -> dict:
    oid: str | None = None
    mime: str | None = None
    fsize: int | None = None

    if file is not None and (file.filename or "").strip():
        raw = await file.read()
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="单文件不得超过 25MB")
        oid = f"supplier/qual/{account.organization_id}/{uuid.uuid4().hex}_{file.filename}"
        mime = file.content_type or "application/octet-stream"
        fsize = len(raw)
        try:
            put_object_bytes(object_key=oid, data=raw, content_type=mime)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"MinIO 写入失败：{exc!s}",
            ) from exc

    try:
        row = sp_svc.create_qualification_record(
            db,
            organization_id=account.organization_id,
            title=title,
            credential_type=credential_type,
            object_key=oid,
            mime_type=mime,
            file_size=fsize,
        )

        emit_audit(
            db,
            _portal_claims(account),
            action="SUPPLIER_QUALIFICATION_CREATE",
            object_type="supplier_qualification",
            object_id=row.id,
            after_data={"organization_id": str(account.organization_id), "has_file": oid is not None},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc

    return envelope_ok(data=sp_svc.qual_to_api(row))


@router.get("/invoices")
def supplier_invoices_list(
    db: DbSession,
    account: SupplierPortalAccountDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§四·6：本企业上传的发票条目（院内登记；元数据摘要）。"""
    try:
        rows, total = fin_svc.list_invoices(
            db,
            organization_id=account.organization_id,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    items = [fin_svc.invoice_to_summary(inv, ocr_review_status=st) for inv, st in rows]
    return envelope_ok(
        data={"items": items, "total": total, "page": page, "page_size": page_size}
    )


@router.get("/invoices/{invoice_id}")
def supplier_invoice_detail(
    db: DbSession,
    account: SupplierPortalAccountDep,
    invoice_id: UUID,
) -> dict:
    """§四·6：单条口径与院内 **五·3** 一致，仅可查本门户 `supplier.organization` 名下发票。"""
    try:
        row = fin_svc.get_invoice(db, invoice_id)
        if row is None or row.organization_id != account.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="发票不存在")
        ocr_status = fin_svc.get_invoice_ocr_status(db, row)
        detail = fin_svc.invoice_to_detail(row)
        detail["ocr_review_status"] = ocr_status
        if row.ai_result_id:
            rst = ai_service.get_result_detail(db, row.ai_result_id)
            if rst is not None:
                detail["ocr_result"] = ai_service.result_to_read(rst)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(data=detail)


@router.get("/payables")
def supplier_payables_list(
    db: DbSession,
    account: SupplierPortalAccountDep,
    payable_status: str | None = Query(
        None, alias="status", description="OPEN/CLOSED 或 ALL（默认不过滤）"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§四·5：`finance.payable` 本单位台账（本院登记；对齐 **五·5** 分页筛选）。"""
    try:
        rows, total = fin_svc.list_payables(
            db,
            organization_id=account.organization_id,
            status=payable_status,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    items = [fin_svc.payable_to_portal_public(r) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/payables/{payable_id}")
def supplier_payable_detail(
    db: DbSession,
    account: SupplierPortalAccountDep,
    payable_id: UUID,
) -> dict:
    """§四·5：单条字段与院内 **五·5.2** 摘要一致但不能查看其他组织的应付；否则 404。"""
    try:
        row = fin_svc.get_payable(db, payable_id)
        if row is None or row.organization_id != account.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应付台账不存在")
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(data=fin_svc.payable_to_portal_public(row))


@router.get("/payments")
def supplier_payments_list(
    db: DbSession,
    account: SupplierPortalAccountDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§四·7：本单位付款核销记录（数据来源 finance.payment / e015）。"""
    try:
        rows, total = fin_svc.list_payments_for_organization(
            db, organization_id=account.organization_id, page=page, page_size=page_size
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    items = [fin_svc.payment_to_portal_public(db, r) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.get("/payments/{payment_id}")
def supplier_payment_detail(
    db: DbSession,
    account: SupplierPortalAccountDep,
    payment_id: UUID,
) -> dict:
    """§四·7：单条与列表 `items[]` 同一结构（不向供应商暴露 `recorded_by_user_id`）；非本组织账目 404。"""
    try:
        row = fin_svc.get_payment(db, payment_id)
        if row is None or row.organization_id != account.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="付款记录不存在")
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PORTAL_SQL_NOT_READY) from exc
    return envelope_ok(data=fin_svc.payment_to_portal_public(db, row))
