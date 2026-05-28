"""请求/响应模型 · docs/06 §十三"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoleCatalogItem(BaseModel):
    code: str
    name: str
    description: str = ""


class SystemUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    username: str
    display_name: str | None
    is_active: bool
    role_codes: list[str]
    created_at: datetime


class SystemUserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(..., min_length=2, max_length=64)
    display_name: str | None = Field(None, max_length=128)
    initial_password: str = Field(..., min_length=8, max_length=128)
    role_codes: list[str] = Field(..., min_length=1)
    is_active: bool = True


class SystemUserPatch(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str | None = Field(None, max_length=128)
    is_active: bool | None = None


class SystemRolesPut(BaseModel):
    role_codes: list[str] = Field(..., min_length=1)


class AdminPasswordResetBody(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class MePasswordBody(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
