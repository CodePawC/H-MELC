"""认证 API（院内用户登录 / JWT）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth import service
from app.modules.auth.deps import get_current_claims_required
from app.modules.auth.schemas import JwtClaims, LoginRequest

router = APIRouter(tags=["auth"])

_IDENTITY_PG_NOT_READY = (
    "身份认证持久化未就绪：请在目标库执行 alembic upgrade head（含 e005_identity_auth）。"
)


def _require_pg_identity() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="认证需在 PostgreSQL 执行 `alembic upgrade head`（含 e005_identity_auth）后使用。",
        )


@router.post("/auth/login")
def login(db: DbSession, body: LoginRequest) -> dict:
    """院内用户登录，返回 JWT（Phase 0：账号由脚本或 SQL 预置）。"""
    _require_pg_identity()
    try:
        tok = service.authenticate_and_issue_token(db, body.username, body.password)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    if tok is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    return envelope_ok(data=tok.model_dump(mode="json"))


@router.get("/auth/me")
def me(claims: JwtClaims = Depends(get_current_claims_required)) -> dict:
    """解析当前 Bearer 令牌中的主体与角色（不查库）。"""
    return envelope_ok(
        data={
            "id": str(claims.sub),
            "username": claims.username,
            "roles": sorted(claims.roles),
        }
    )
