"""数字运营中心 Pydantic schema。"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AccessKeyCreate(BaseModel):
    key_name: str = Field(min_length=1, max_length=128)
    screen_code: str = Field(min_length=1, max_length=64)
    access_key: str | None = Field(default=None, max_length=160)
    is_enabled: bool = True
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    allowed_ips: str | None = None
    desensitized: bool = True
    refresh_interval_seconds: int = Field(default=60, ge=10, le=3600)
    carousel_interval_seconds: int = Field(default=15, ge=5, le=600)


class AccessKeyPatch(BaseModel):
    key_name: str | None = Field(default=None, min_length=1, max_length=128)
    screen_code: str | None = Field(default=None, min_length=1, max_length=64)
    access_key: str | None = Field(default=None, max_length=160)
    is_enabled: bool | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    allowed_ips: str | None = None
    desensitized: bool | None = None
    refresh_interval_seconds: int | None = Field(default=None, ge=10, le=3600)
    carousel_interval_seconds: int | None = Field(default=None, ge=5, le=600)


class TerminalCreate(BaseModel):
    terminal_name: str = Field(min_length=1, max_length=128)
    location: str | None = Field(default=None, max_length=255)
    screen_code: str = Field(min_length=1, max_length=64)
    access_key_id: UUID | None = None
    resolution: str = Field(default="1920x1080", max_length=64)
    online_status: str = Field(default="OFFLINE", max_length=32)
    last_heartbeat_at: datetime | None = None
    remark: str | None = None


class TerminalPatch(BaseModel):
    terminal_name: str | None = Field(default=None, min_length=1, max_length=128)
    location: str | None = Field(default=None, max_length=255)
    screen_code: str | None = Field(default=None, min_length=1, max_length=64)
    access_key_id: UUID | None = None
    resolution: str | None = Field(default=None, max_length=64)
    online_status: str | None = Field(default=None, max_length=32)
    last_heartbeat_at: datetime | None = None
    remark: str | None = None

