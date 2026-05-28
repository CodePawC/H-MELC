"""将关键业务动作写入 audit.audit_log（失败不阻断主流程）。"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.session import engine
from app.modules.audit.schemas import AuditLogCreate
from app.modules.audit.service import append_log
from app.modules.auth.schemas import JwtClaims


def emit_audit(
    session: Session,
    actor: JwtClaims,
    *,
    action: str,
    object_type: str | None = None,
    object_id: UUID | None = None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
) -> None:
    if engine.dialect.name != "postgresql":
        return
    role_code = sorted(actor.roles)[0] if actor.roles else None
    try:
        append_log(
            session,
            AuditLogCreate(
                user_id=actor.sub,
                username=actor.username,
                role_code=role_code,
                action=action,
                object_type=object_type,
                object_id=object_id,
                before_data=before_data,
                after_data=after_data,
            ),
        )
    except Exception:
        session.rollback()
