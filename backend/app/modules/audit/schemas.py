"""审计 API Pydantic 模型."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None
    username: str | None = None
    role_code: str | None = None
    action: str
    object_type: str | None = None
    object_id: UUID | None = None
    before_data: dict[str, Any] | None = None
    after_data: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class AuditLogCreate(BaseModel):
    """供服务层写入；Phase 0 无网关鉴权时用固定测试身份。"""

    user_id: UUID | None = None
    username: str | None = None
    role_code: str | None = None
    action: str = "UNKNOWN"
    object_type: str | None = None
    object_id: UUID | None = None
    before_data: dict[str, Any] | None = None
    after_data: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
