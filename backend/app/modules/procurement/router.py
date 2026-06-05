"""采购协同管理 API —— 医院采购项目全流程管理。

覆盖：采购项目库、对外发布、供应商报名、资质审核、澄清答疑、通知中心。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import (
    RBAC_ASSET_READ,
    RBAC_ASSET_WRITE,
    RBAC_PROCUREMENT_PUBLISH,
    RBAC_PROCUREMENT_READ,
    RBAC_PROCUREMENT_REVIEW,
)
from app.modules.auth.schemas import JwtClaims

router = APIRouter(prefix="/procurement", tags=["procurement"])
portal_router = APIRouter(prefix="/procurement-portal", tags=["procurement-portal"])
supplier_router = APIRouter(prefix="/supplier/procurement", tags=["supplier-procurement"])

PROJECT_STATUSES = [
    "DRAFT", "PENDING_REVIEW", "PUBLISHED", "REGISTERING", "QUALIFYING",
    "INQUIRING", "BIDDING", "EVALUATING", "AWARDED", "TERMINATED", "ARCHIVED",
]
# Publicly visible statuses
PUBLIC_STATUSES = {"PUBLISHED", "REGISTERING", "QUALIFYING", "INQUIRING", "BIDDING", "EVALUATING", "AWARDED"}


def _ensure_pg() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=503, detail="采购协同管理需要 PostgreSQL")


PgDep = Depends(_ensure_pg)


def _ts() -> str:
    return datetime.now(UTC).isoformat()


def _project_to_dict(row: Any, include_all: bool = False) -> dict[str, Any]:
    """Serialize procurement project to API response."""
    base = {
        "id": str(row.id),
        "project_code": row.project_code or "",
        "title": row.title,
        "category": row.category or "",
        "procurement_method": row.procurement_method or "",
        "budget_amount": float(row.budget_amount) if row.budget_amount else None,
        "status": row.status,
        "summary": row.summary or "",
        "department_name": row.department_name or "",
        "registration_start": row.registration_start.isoformat() if row.registration_start else None,
        "registration_end": row.registration_end.isoformat() if row.registration_end else None,
        "bid_deadline": row.bid_deadline.isoformat() if row.bid_deadline else None,
        "publish_at": row.publish_at.isoformat() if row.publish_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    if include_all:
        base.update({
            "content": row.content or "",
            "tech_params": row.tech_params or "",
            "config_list": row.config_list or "",
            "service_requirements": row.service_requirements or "",
            "delivery_requirements": row.delivery_requirements or "",
            "acceptance_requirements": row.acceptance_requirements or "",
            "qualification_requirements": row.qualification_requirements or "",
            "draft": bool(row.draft),
            "archived": bool(row.archived),
            "is_public": bool(row.is_public),
            "publisher_user_id": str(row.publisher_user_id) if row.publisher_user_id else "",
            "review_remark": row.review_remark or "",
            "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            "reviewer_user_id": str(row.reviewer_user_id) if row.reviewer_user_id else "",
            "winning_bid_id": str(row.winning_bid_id) if row.winning_bid_id else None,
        })
    return base


def _enrollment_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "project_id": str(row.project_id),
        "organization_id": str(row.organization_id),
        "status": row.status,
        "contact_name": row.contact_name or "",
        "contact_phone": row.contact_phone or "",
        "contact_email": row.contact_email or "",
        "review_comment": row.review_comment or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


# ═══════════════════════════════════════════════════════════
# 管理端 API（医院内部）
# ═══════════════════════════════════════════════════════════

@router.get("", dependencies=[PgDep])
def list_procurement_projects(
    db: DbSession,
    status_filter: str | None = Query(None, alias="status"),
    keyword: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
) -> dict:
    """采购项目库列表（管理端）。"""
    q = select(text("*")).select_from(text("supplier.procurement_project")).order_by(text("created_at DESC"))
    params: dict[str, Any] = {}
    where: list[str] = ["1=1"]

    if status_filter and status_filter != "all":
        where.append("status = :status")
        params["status"] = status_filter
    if keyword:
        where.append("(title ILIKE :kw OR project_code ILIKE :kw)")
        params["kw"] = f"%{keyword}%"
    if category:
        where.append("category = :cat")
        params["cat"] = category

    sql_where = " AND ".join(where)
    total = db.execute(text(f"SELECT count(*) FROM supplier.procurement_project WHERE {sql_where}"), params).scalar() or 0
    rows = db.execute(
        text(f"SELECT * FROM supplier.procurement_project WHERE {sql_where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).all()
    items = [_project_to_dict(r, include_all=True) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@router.post("", dependencies=[PgDep])
def create_procurement_project(
    db: DbSession,
    body: dict[str, Any],
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_PUBLISH)),
) -> dict:
    """新建采购项目。"""
    import uuid as _uuid
    pid = str(_uuid.uuid4())
    now = _ts()
    fields = {
        "id": pid, "title": body["title"], "status": body.get("status", "DRAFT"),
        "category": body.get("category", ""), "procurement_method": body.get("procurement_method", ""),
        "budget_amount": body.get("budget_amount"), "content": body.get("content", ""),
        "summary": body.get("summary", ""), "department_name": body.get("department_name", ""),
        "tech_params": body.get("tech_params", ""), "config_list": body.get("config_list", ""),
        "service_requirements": body.get("service_requirements", ""),
        "delivery_requirements": body.get("delivery_requirements", ""),
        "acceptance_requirements": body.get("acceptance_requirements", ""),
        "qualification_requirements": body.get("qualification_requirements", ""),
        "registration_start": body.get("registration_start"), "registration_end": body.get("registration_end"),
        "bid_deadline": body.get("bid_deadline"), "draft": body.get("status", "DRAFT") == "DRAFT",
        "publisher_user_id": str(actor.sub), "project_code": body.get("project_code", ""),
        "created_at": now, "is_public": body.get("is_public", False),
    }

    cols = ", ".join(fields.keys())
    vals = ", ".join(f":{k}" for k in fields.keys())
    db.execute(text(f"INSERT INTO supplier.procurement_project ({cols}) VALUES ({vals})"), fields)
    db.commit()
    row = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": pid}).first()
    return envelope_ok(data=_project_to_dict(row, include_all=True))


@router.get("/{project_id}", dependencies=[PgDep])
def get_procurement_project(
    db: DbSession,
    project_id: str,
    _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
) -> dict:
    """项目详情（管理端，含全部字段）。"""
    row = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在")
    return envelope_ok(data=_project_to_dict(row, include_all=True))


@router.patch("/{project_id}", dependencies=[PgDep])
def update_procurement_project(
    db: DbSession,
    project_id: str,
    body: dict[str, Any],
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_PUBLISH)),
) -> dict:
    """更新采购项目（部分字段）。"""
    existing = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    if not existing:
        raise HTTPException(status_code=404, detail="项目不存在")

    allowed = {"title", "category", "procurement_method", "budget_amount", "content", "summary",
               "department_name", "tech_params", "config_list", "service_requirements",
               "delivery_requirements", "acceptance_requirements", "qualification_requirements",
               "registration_start", "registration_end", "bid_deadline", "project_code", "is_public"}
    updates: dict[str, Any] = {}
    for k in body:
        if k in allowed:
            updates[k] = body[k]
    if not updates:
        return envelope_ok(data={"message": "无变更"})

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = project_id
    db.execute(text(f"UPDATE supplier.procurement_project SET {set_clause} WHERE id = :id"), updates)
    db.commit()
    row = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    return envelope_ok(data=_project_to_dict(row, include_all=True))


@router.post("/{project_id}/status", dependencies=[PgDep])
def transition_project_status(
    db: DbSession,
    project_id: str,
    body: dict[str, Any],
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_REVIEW)),
) -> dict:
    """项目状态流转：发布/暂停/终止/归档等。"""
    new_status = body.get("status", "").strip().upper()
    if new_status not in PROJECT_STATUSES:
        raise HTTPException(status_code=400, detail=f"无效状态: {new_status}")

    row = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在")

    now = _ts()
    extra = {"status": new_status}
    if new_status == "PUBLISHED":
        extra["draft"] = False
        extra["publish_at"] = now
    if new_status in ("ARCHIVED", "TERMINATED", "AWARDED"):
        extra["archived"] = True

    db.execute(text("UPDATE supplier.procurement_project SET status = :status, publish_at = :pub, draft = :draft, archived = :arch WHERE id = :id"),
               {"status": new_status, "pub": extra.get("publish_at"), "draft": extra.get("draft", row.draft),
                "arch": extra.get("archived", row.archived), "id": project_id})
    db.commit()
    return envelope_ok(data={"id": project_id, "status": new_status, "message": f"项目状态已变更为 {new_status}"})


@router.get("/{project_id}/enrollments", dependencies=[PgDep])
def list_enrollments(
    db: DbSession,
    project_id: str,
    _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ)),
) -> dict:
    """查看项目报名供应商列表。"""
    rows = db.execute(
        text("SELECT e.*, o.legal_name FROM supplier.procurement_enrollment e "
             "LEFT JOIN supplier.organization o ON o.id = e.organization_id "
             "WHERE e.project_id = :pid ORDER BY e.created_at"),
        {"pid": project_id},
    ).all()
    items = []
    for r in rows:
        d = _enrollment_to_dict(r)
        d["legal_name"] = getattr(r, "legal_name", "")
        items.append(d)
    return envelope_ok(data={"items": items, "total": len(items)})


@router.post("/{project_id}/enrollments/{enrollment_id}/review", dependencies=[PgDep])
def review_enrollment(
    db: DbSession,
    project_id: str,
    enrollment_id: str,
    body: dict[str, Any],
    actor: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_REVIEW)),
) -> dict:
    """审核供应商报名。"""
    decision = body.get("decision", "").upper()
    comment = body.get("comment", "")
    if decision not in ("APPROVED", "REJECTED", "RETURNED"):
        raise HTTPException(status_code=400, detail="decision 需为 APPROVED/REJECTED/RETURNED")

    db.execute(
        text("UPDATE supplier.procurement_enrollment SET status = :st, review_comment = :cm, reviewed_by = :rb, reviewed_at = :now WHERE id = :id"),
        {"st": decision, "cm": comment, "rb": str(actor.sub), "now": _ts(), "id": enrollment_id},
    )
    db.commit()
    return envelope_ok(data={"id": enrollment_id, "status": decision})


# ═══════════════════════════════════════════════════════════
# 对外门户 API（无需登录/供应商JWT）
# ═══════════════════════════════════════════════════════════

@portal_router.get("/projects")
def list_public_projects(
    db: DbSession,
    keyword: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """对外展示采购项目列表（公开）。"""
    where = ["is_public = true", "draft = false"]
    params: dict[str, Any] = {"pub": True}
    if keyword:
        where.append("(title ILIKE :kw OR project_code ILIKE :kw)")
        params["kw"] = f"%{keyword}%"
    if category:
        where.append("category = :cat")
        params["cat"] = category
    if status and status != "all":
        where.append("status = :st")
        params["st"] = status
    else:
        where.append("status IN :pub_st")
        params["pub_st"] = tuple(PUBLIC_STATUSES)

    sql_where = " AND ".join(where)
    total = db.execute(text(f"SELECT count(*) FROM supplier.procurement_project WHERE {sql_where}"), params).scalar() or 0
    rows = db.execute(
        text(f"SELECT * FROM supplier.procurement_project WHERE {sql_where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).all()
    items = [_project_to_dict(r) for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@portal_router.get("/projects/{project_id}")
def get_public_project_detail(db: DbSession, project_id: str) -> dict:
    """项目详情（公开）。"""
    row = db.execute(
        text("SELECT * FROM supplier.procurement_project WHERE id = :id AND is_public = true AND draft = false"),
        {"id": project_id},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在或未公开")
    # Include all public fields
    data = _project_to_dict(row, include_all=True)
    return envelope_ok(data=data)


# ═══════════════════════════════════════════════════════════
# 供应商端 API（需要 SUPPLIER JWT）
# ═══════════════════════════════════════════════════════════

@supplier_router.get("/enrollments")
def list_my_enrollments(
    db: DbSession,
    claims: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """我的报名列表。"""
    rows = db.execute(
        text("SELECT e.*, p.title as project_title, p.project_code, p.status as project_status "
             "FROM supplier.procurement_enrollment e "
             "LEFT JOIN supplier.procurement_project p ON p.id = e.project_id "
             "WHERE e.organization_id = :oid ORDER BY e.created_at DESC LIMIT :limit OFFSET :offset"),
        {"oid": claims.sub, "limit": page_size, "offset": (page - 1) * page_size},
    ).all()
    total = db.execute(text("SELECT count(*) FROM supplier.procurement_enrollment WHERE organization_id = :oid"), {"oid": claims.sub}).scalar() or 0
    items = []
    for r in rows:
        d = _enrollment_to_dict(r)
        d["project_title"] = getattr(r, "project_title", "")
        d["project_code"] = getattr(r, "project_code", "")
        d["project_status"] = getattr(r, "project_status", "")
        items.append(d)
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@supplier_router.post("/enrollments")
def create_enrollment(
    db: DbSession,
    body: dict[str, Any],
    claims: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """供应商报名参加项目。"""
    project_id = body.get("project_id", "")
    if not project_id:
        raise HTTPException(status_code=400, detail="缺少 project_id")

    # Check project exists and is open for registration
    project = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status not in ("PUBLISHED", "REGISTERING", "QUALIFYING"):
        raise HTTPException(status_code=400, detail="项目当前不接受报名")

    # Check duplicate
    existing = db.execute(
        text("SELECT id FROM supplier.procurement_enrollment WHERE project_id = :pid AND organization_id = :oid"),
        {"pid": project_id, "oid": claims.sub},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="已报名该项目")

    import uuid as _uuid
    eid = str(_uuid.uuid4())
    db.execute(
        text("INSERT INTO supplier.procurement_enrollment (id, project_id, organization_id, portal_account_id, "
             "contact_name, contact_phone, contact_email) "
             "VALUES (:id, :pid, :oid, :paid, :cn, :cp, :ce)"),
        {"id": eid, "pid": project_id, "oid": claims.sub, "paid": str(claims.sub),
         "cn": body.get("contact_name", ""), "cp": body.get("contact_phone", ""), "ce": body.get("contact_email", "")},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM supplier.procurement_enrollment WHERE id = :id"), {"id": eid}).first()
    # Create notification
    db.execute(
        text("INSERT INTO supplier.notification_message (organization_id, title, content, notification_type) "
             "VALUES (:oid, :title, :content, 'ENROLLMENT')"),
        {"oid": claims.sub, "title": "报名成功", "content": f"您已成功报名项目：{project.title}"},
    )
    db.commit()
    return envelope_ok(data=_enrollment_to_dict(row))


@supplier_router.get("/notifications")
def list_my_notifications(
    db: DbSession,
    claims: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """我的消息列表。"""
    rows = db.execute(
        text("SELECT * FROM supplier.notification_message WHERE organization_id = :oid "
             "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
        {"oid": claims.sub, "limit": page_size, "offset": (page - 1) * page_size},
    ).all()
    total = db.execute(text("SELECT count(*) FROM supplier.notification_message WHERE organization_id = :oid"), {"oid": claims.sub}).scalar() or 0
    items = [{
        "id": str(r.id), "title": r.title, "content": r.content,
        "notification_type": r.notification_type, "is_read": bool(r.is_read),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]
    return envelope_ok(data={"items": items, "total": total, "page": page, "page_size": page_size})


@supplier_router.post("/notifications/{nid}/read")
def mark_notification_read(
    db: DbSession,
    nid: str,
    claims: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """标记消息为已读。"""
    db.execute(
        text("UPDATE supplier.notification_message SET is_read = true, read_at = :now WHERE id = :id AND organization_id = :oid"),
        {"id": nid, "oid": claims.sub, "now": _ts()},
    )
    db.commit()
    return envelope_ok(data={"id": nid, "is_read": True})
