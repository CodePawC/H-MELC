"""认证 API 模型。"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None = None
    roles: list[str] = Field(default_factory=list)


class TokenEnvelope(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic


class JwtClaims(BaseModel):
    sub: UUID
    username: str
    roles: frozenset[str]

    @classmethod
    def from_payload(cls, payload: dict[str, object]) -> JwtClaims:
        raw_roles = payload.get("roles") or []
        roles = raw_roles if isinstance(raw_roles, list) else []
        return cls(
            sub=UUID(str(payload["sub"])),
            username=str(payload["username"]),
            roles=frozenset(str(r) for r in roles),
        )
