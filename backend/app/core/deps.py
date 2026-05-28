from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db


def get_request_id(
    x_request_id: Annotated[str | None, Header(alias="X-Request-ID")] = None,
) -> str | None:
    return x_request_id


def get_audit_actor(
    authorization: Annotated[str | None, Header()] = None,
) -> str | None:
    """解析调用方身份占位；后续可接入 JWT / 医院 SSO，并写入审计日志。"""
    if authorization and authorization.startswith("Bearer "):
        return "bearer-user"
    return None


def require_authenticated(
    actor: Annotated[str | None, Depends(get_audit_actor)],
) -> str:
    if not actor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证",
        )
    return actor


DbSession = Annotated[Session, Depends(get_db)]
