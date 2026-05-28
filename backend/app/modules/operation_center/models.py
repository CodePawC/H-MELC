"""数字运营中心 ORM · schema `operation_center`。"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ScreenAccessKey(Base):
    __tablename__ = "screen_access_key"
    __table_args__ = {"schema": "operation_center"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_name: Mapped[str] = mapped_column(String(128), nullable=False)
    screen_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    access_key: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    allowed_ips: Mapped[str | None] = mapped_column(Text())
    desensitized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    refresh_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    carousel_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_access_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_by_username: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )

    terminals: Mapped[list["ScreenTerminal"]] = relationship("ScreenTerminal", back_populates="key")


class ScreenTerminal(Base):
    __tablename__ = "screen_terminal"
    __table_args__ = {"schema": "operation_center"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terminal_name: Mapped[str] = mapped_column(String(128), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    screen_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    access_key_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("operation_center.screen_access_key.id", ondelete="SET NULL"), index=True
    )
    resolution: Mapped[str] = mapped_column(String(64), nullable=False, default="1920x1080")
    online_status: Mapped[str] = mapped_column(String(32), nullable=False, default="OFFLINE")
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )

    key: Mapped[ScreenAccessKey | None] = relationship("ScreenAccessKey", back_populates="terminals")


class ScreenAccessLog(Base):
    __tablename__ = "screen_access_log"
    __table_args__ = {"schema": "operation_center"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    access_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    access_ip: Mapped[str | None] = mapped_column(String(64), index=True)
    screen_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    access_key: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    access_key_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    terminal_name: Mapped[str | None] = mapped_column(String(128))
    user_agent: Mapped[str | None] = mapped_column(Text())
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    failure_reason: Mapped[str | None] = mapped_column(String(255))

