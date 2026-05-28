"""用户/角色业务逻辑 · docs/06 §十三"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modules.auth.service import hash_password, verify_password
from app.modules.identity.models import AppUser, UserRole
from app.modules.system.schemas import (
    RoleCatalogItem,
    SystemUserCreate,
    SystemUserPatch,
    SystemUserSummary,
)

ROLE_CATALOG: tuple[RoleCatalogItem, ...] = (
    RoleCatalogItem(code="SYS_ADMIN", name="系统管理员", description="全局配置与用户管理"),
    RoleCatalogItem(code="DEVICE_ADMIN", name="设备科管理员", description="台账、维修、财务等业务管理"),
    RoleCatalogItem(code="ENGINEER", name="工程师", description="接单、维修执行"),
    RoleCatalogItem(code="DEPT_USER", name="科室用户", description="报修与确认"),
    RoleCatalogItem(code="AUDIT_ADMIN", name="审计管理员", description="审计日志与合规查询"),
)

ALLOWED_ROLE_CODES = frozenset(x.code for x in ROLE_CATALOG)


def catalog_roles() -> list[RoleCatalogItem]:
    return list(ROLE_CATALOG)


def _validate_role_codes(codes: Sequence[str]) -> None:
    unknown = [c for c in codes if c not in ALLOWED_ROLE_CODES]
    if unknown:
        raise ValueError(f"未知角色代码: {', '.join(unknown)}")


def _to_summary(row: AppUser) -> SystemUserSummary:
    codes = sorted({r.role_code for r in row.roles})
    return SystemUserSummary(
        id=row.id,
        username=row.username,
        display_name=row.display_name,
        is_active=row.is_active,
        role_codes=codes,
        created_at=row.created_at,
    )


def list_users(
    session: Session,
    *,
    keyword: str | None,
    role: str | None,
    is_active: bool | None,
    page: int,
    page_size: int,
) -> tuple[list[SystemUserSummary], int, int, int]:
    p = max(1, page)
    ps = min(100, max(1, page_size))
    stmt = select(AppUser).options(selectinload(AppUser.roles))
    count_stmt = select(func.count()).select_from(AppUser)

    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        cond = or_(AppUser.username.ilike(kw), AppUser.display_name.ilike(kw))  # type: ignore[arg-type]
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    if is_active is not None:
        stmt = stmt.where(AppUser.is_active == is_active)
        count_stmt = count_stmt.where(AppUser.is_active == is_active)

    if role and role.strip():
        rc = role.strip()
        stmt = (
            stmt.join(UserRole, UserRole.user_id == AppUser.id)
            .where(UserRole.role_code == rc)
            .distinct()
        )
        count_stmt = (
            select(func.count(func.distinct(AppUser.id)))
            .select_from(AppUser)
            .join(UserRole, UserRole.user_id == AppUser.id)
            .where(UserRole.role_code == rc)
        )
        if keyword and keyword.strip():
            kw = f"%{keyword.strip()}%"
            cond = or_(AppUser.username.ilike(kw), AppUser.display_name.ilike(kw))  # type: ignore[arg-type]
            count_stmt = count_stmt.where(cond)
        if is_active is not None:
            count_stmt = count_stmt.where(AppUser.is_active == is_active)

    total = int(session.execute(count_stmt).scalar_one())
    stmt = stmt.order_by(AppUser.created_at.desc())
    offset = (p - 1) * ps
    rows = session.execute(stmt.offset(offset).limit(ps)).scalars().unique().all()
    return [_to_summary(r) for r in rows], total, p, ps


def get_user(session: Session, user_id: UUID) -> SystemUserSummary | None:
    row = session.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.id == user_id)
    ).scalar_one_or_none()
    if row is None:
        return None
    return _to_summary(row)


def create_user(session: Session, body: SystemUserCreate) -> SystemUserSummary | tuple[str, str]:
    _validate_role_codes(body.role_codes)
    exists = session.execute(select(AppUser.id).where(AppUser.username == body.username)).scalar_one_or_none()
    if exists is not None:
        return ("conflict", "用户名已存在")
    uid = uuid.uuid4()
    user = AppUser(
        id=uid,
        username=body.username,
        password_hash=hash_password(body.initial_password),
        display_name=body.display_name,
        is_active=body.is_active,
    )
    session.add(user)
    for c in sorted(set(body.role_codes)):
        session.add(UserRole(user_id=uid, role_code=c))
    session.flush()
    session.refresh(user, attribute_names=["roles"])
    return _to_summary(user)


def patch_user(session: Session, user_id: UUID, body: SystemUserPatch) -> SystemUserSummary | tuple[str, str]:
    row = session.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.id == user_id)
    ).scalar_one_or_none()
    if row is None:
        return ("not_found", "用户不存在")
    if body.display_name is not None:
        row.display_name = body.display_name
    if body.is_active is not None:
        row.is_active = body.is_active
    session.flush()
    session.refresh(row, attribute_names=["roles"])
    return _to_summary(row)


def replace_user_roles(
    session: Session, user_id: UUID, role_codes: list[str]
) -> SystemUserSummary | tuple[str, str]:
    _validate_role_codes(role_codes)
    row = session.execute(
        select(AppUser).options(selectinload(AppUser.roles)).where(AppUser.id == user_id)
    ).scalar_one_or_none()
    if row is None:
        return ("not_found", "用户不存在")
    session.execute(delete(UserRole).where(UserRole.user_id == user_id))
    for c in sorted(set(role_codes)):
        session.add(UserRole(user_id=user_id, role_code=c))
    session.flush()
    session.refresh(row, attribute_names=["roles"])
    return _to_summary(row)


def admin_reset_password(
    session: Session, user_id: UUID, new_password: str
) -> None | tuple[str, str]:
    row = session.execute(select(AppUser).where(AppUser.id == user_id)).scalar_one_or_none()
    if row is None:
        return ("not_found", "用户不存在")
    row.password_hash = hash_password(new_password)
    session.flush()
    return None


def change_own_password(
    session: Session, user_id: UUID, old_password: str, new_password: str
) -> None | tuple[str, str]:
    row = session.execute(select(AppUser).where(AppUser.id == user_id)).scalar_one_or_none()
    if row is None:
        return ("not_found", "用户不存在")
    if not verify_password(old_password, row.password_hash):
        return ("bad_password", "原密码错误")
    row.password_hash = hash_password(new_password)
    session.flush()
    return None
