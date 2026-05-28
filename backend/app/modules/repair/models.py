"""报修维修 ORM，对齐 docs/03_数据库设计/04_核心表结构设计.md · 三。"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RepairOrder(Base):
    __tablename__ = "repair_order"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    report_department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reporter_name: Mapped[str | None] = mapped_column(String(128))
    reporter_phone: Mapped[str | None] = mapped_column(String(64))
    fault_description: Mapped[str | None] = mapped_column(Text())
    fault_type: Mapped[str | None] = mapped_column(String(64))
    fault_level: Mapped[str | None] = mapped_column(String(32))
    priority: Mapped[str | None] = mapped_column(String(32))
    order_status: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING_DISPATCH")
    assigned_engineer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_outsourced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_return_factory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_chargeable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    estimated_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    actual_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    ai_risk_level: Mapped[str | None] = mapped_column(String(64))
    ai_incident_suggestion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )

    attachments: Mapped[list["RepairAttachment"]] = relationship(
        "RepairAttachment", back_populates="repair_order", cascade="all, delete-orphan"
    )
    process_records: Mapped[list["RepairProcessRecord"]] = relationship(
        "RepairProcessRecord",
        back_populates="repair_order",
        cascade="all, delete-orphan",
    )
    report_row: Mapped["RepairReport | None"] = relationship(
        "RepairReport", back_populates="repair_order", uselist=False, cascade="all, delete-orphan"
    )


class RepairAttachment(Base):
    __tablename__ = "repair_attachment"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    file_type: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text())
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    repair_order: Mapped["RepairOrder"] = relationship("RepairOrder", back_populates="attachments")


class RepairProcessRecord(Base):
    __tablename__ = "repair_process_record"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    record_type: Mapped[str | None] = mapped_column(String(64))
    content: Mapped[str | None] = mapped_column(Text())
    engineer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    engineer_name: Mapped[str | None] = mapped_column(String(128))
    ai_assisted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ai_result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    record_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    repair_order: Mapped["RepairOrder"] = relationship("RepairOrder", back_populates="process_records")


class RepairReport(Base):
    __tablename__ = "repair_report"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    fault_cause: Mapped[str | None] = mapped_column(Text())
    repair_method: Mapped[str | None] = mapped_column(Text())
    replaced_parts: Mapped[str | None] = mapped_column(Text())
    test_result: Mapped[str | None] = mapped_column(Text())
    conclusion: Mapped[str | None] = mapped_column(Text())
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ai_result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    department_confirm_status: Mapped[str | None] = mapped_column(String(64))
    department_confirm_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    department_confirm_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    repair_order: Mapped["RepairOrder"] = relationship("RepairOrder", back_populates="report_row")
