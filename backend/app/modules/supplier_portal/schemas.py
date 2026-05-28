"""供应商门户请求/响应（部分走统一信封 envelope_ok）。"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupplierLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class SupplierUserPublic(BaseModel):
    """门户用户：`user` 节点（签发 JWT 时 roles 固定含 SUPPLIER）。"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    organization_id: UUID
    legal_name: str
    roles: list[str] = Field(default_factory=lambda: ["SUPPLIER"])


class SupplierTokenEnvelope(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: SupplierUserPublic


class QualificationReviewBody(BaseModel):
    """院内审核供应商资质（对齐 AI 结果确认的 `confirm_status` 命名）。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    confirm_status: Annotated[
        Literal["ACCEPTED", "REJECTED"],
        Field(..., description="通过或驳回"),
    ]
    comment: str | None = Field(None, max_length=4096)