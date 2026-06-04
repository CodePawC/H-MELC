"""JWT 依赖与角色校验。支持 standalone + unified 双模式。"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.core.config import get_settings
from app.modules.auth.jwt_tools import decode_token, extract_roles_from_payload
from app.modules.auth.schemas import JwtClaims


def _auth_error(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": code, "message": message},
    )


def _parse_bearer(authorization: str | None, *, optional: bool) -> JwtClaims | None:
    if authorization is None or not authorization.startswith("Bearer "):
        if optional:
            return None
        raise _auth_error("AUTH_TOKEN_MISSING", "未提供访问令牌")
    raw = authorization.removeprefix("Bearer ").strip()
    if not raw:
        if optional:
            return None
        raise _auth_error("AUTH_TOKEN_MISSING", "未提供访问令牌")
    try:
        payload = decode_token(raw)
        # 统一提取角色（standalone roles 或 unified systems.H-MELC.roles）
        roles = extract_roles_from_payload(payload)
        payload["roles"] = roles
        return JwtClaims.from_payload(payload)
    except Exception:
        if optional:
            return None
        raise _auth_error("AUTH_TOKEN_INVALID", "令牌无效或已过期")


def get_current_claims_optional(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> JwtClaims | None:
    return _parse_bearer(authorization, optional=True)


def get_current_claims_required(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> JwtClaims:
    return _parse_bearer(authorization, optional=False)  # type: ignore[return-value]


def require_roles(*allowed_roles: str):
    allowed = frozenset(allowed_roles)

    def verifier(claims: JwtClaims = Depends(get_current_claims_required)) -> JwtClaims:
        if not allowed.intersection(claims.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="当前角色无权执行此操作",
            )
        return claims

    return verifier
