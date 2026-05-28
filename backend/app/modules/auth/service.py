"""登录与口令校验."""

from __future__ import annotations

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.audit.schemas import AuditLogCreate
from app.modules.audit.service import append_log
from app.modules.auth.jwt_tools import create_access_token
from app.modules.auth.schemas import TokenEnvelope, UserPublic
from app.modules.identity.models import AppUser


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    """注册脚本与测试构造口令用。"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def _user_public(row: AppUser) -> UserPublic:
    codes = sorted({r.role_code for r in row.roles})
    return UserPublic(
        id=row.id,
        username=row.username,
        display_name=row.display_name,
        roles=codes,
    )


def authenticate_and_issue_token(session: Session, username: str, password: str) -> TokenEnvelope | None:
    row = session.execute(
        select(AppUser)
        .options(selectinload(AppUser.roles))
        .where(AppUser.username == username)
    ).scalar_one_or_none()
    if row is None or not row.is_active:
        return None
    if not verify_password(password, row.password_hash):
        return None
    roles = sorted({r.role_code for r in row.roles})
    token, ttl = create_access_token(subject=row.id, username=row.username, roles=roles)
    append_log(
        session,
        AuditLogCreate(
            action="LOGIN_SUCCESS",
            user_id=row.id,
            username=row.username,
            role_code=roles[0] if roles else None,
            object_type="auth",
            after_data={"roles": roles},
        ),
    )
    return TokenEnvelope(access_token=token, expires_in=ttl, user=_user_public(row))
