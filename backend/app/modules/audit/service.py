"""审计查询与写入."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditLogCreate, AuditLogRead


def _normalize_page(page: int, page_size: int) -> tuple[int, int]:
    p = max(1, page)
    ps = min(100, max(1, page_size))
    return p, ps


def append_log(session: Session, payload: AuditLogCreate, *, flush_only: bool = False) -> AuditLogRead:
    row = AuditLog(**payload.model_dump())
    session.add(row)
    if flush_only:
        session.flush()
    else:
        session.commit()
        session.refresh(row)
    return AuditLogRead.model_validate(row)


def list_logs(
    session: Session,
    *,
    user_id: UUID | None = None,
    username: str | None = None,
    role_code: str | None = None,
    action: str | None = None,
    object_type: str | None = None,
    object_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AuditLogRead], int, int, int]:
    """按时间与常用维度过滤（文档 §九 仅描述路径；查询参数为本期惯例）。"""
    conds: list = []
    if user_id is not None:
        conds.append(AuditLog.user_id == user_id)
    if username:
        conds.append(AuditLog.username.ilike(f"%{username}%"))
    if role_code:
        conds.append(AuditLog.role_code == role_code)
    if action:
        conds.append(AuditLog.action.ilike(f"%{action}%"))
    if object_type:
        conds.append(AuditLog.object_type == object_type)
    if object_id is not None:
        conds.append(AuditLog.object_id == object_id)
    if date_from is not None:
        conds.append(func.date(AuditLog.created_at) >= date_from)
    if date_to is not None:
        conds.append(func.date(AuditLog.created_at) <= date_to)

    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)
    if conds:
        stmt = stmt.where(*conds)
        count_stmt = count_stmt.where(*conds)

    stmt = stmt.order_by(AuditLog.created_at.desc())
    page, page_size = _normalize_page(page, page_size)
    total = session.execute(count_stmt).scalar_one()
    offset = (page - 1) * page_size

    rows = session.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    items = [AuditLogRead.model_validate(r) for r in rows]
    return items, int(total), page, page_size
