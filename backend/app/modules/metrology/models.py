"""计量与合规 ORM · schema `metrology`。"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MetrologyDevice(Base):
    __tablename__ = "metrology_device"
    __table_args__ = {"schema": "metrology"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    regulatory_class: Mapped[str] = mapped_column(String(64), nullable=False, default="GENERAL")
    calibration_status: Mapped[str] = mapped_column(String(32), nullable=False, default="NORMAL", index=True)
    meter_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cycle_months: Mapped[int] = mapped_column(Integer(), nullable=False, default=12)
    last_calibrated_at: Mapped[date | None] = mapped_column(Date(), nullable=True)
    next_due_date: Mapped[date | None] = mapped_column(Date(), nullable=True, index=True)
    issuing_body: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )


class CalibrationPlan(Base):
    __tablename__ = "calibration_plan"
    __table_args__ = {"schema": "metrology"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    plan_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PLANNED", index=True)
    assigned_org: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )


class MetrologyCertificate(Base):
    __tablename__ = "metrology_certificate"
    __table_args__ = {"schema": "metrology"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, index=True
    )
    certificate_no: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    issued_at: Mapped[date | None] = mapped_column(Date(), nullable=True)
    valid_to: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    issuing_body: Mapped[str | None] = mapped_column(String(255), nullable=True)
    conclusion: Mapped[str] = mapped_column(String(64), nullable=False, default="PASS")
    object_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
