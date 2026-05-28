"""PM（预防性维护）ORM · schema `pm`。

对齐 docs/06_接口设计/01_API接口设计.md · 十；迁移 e017_pm_core。
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PmPlan(Base):
    __tablename__ = "pm_plan"
    __table_args__ = {"schema": "pm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    frequency: Mapped[str] = mapped_column(String(32), nullable=False)
    next_due_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    owner_department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mdm_department_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    department_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    department_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    department_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text())
    plan_status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )


class PmTask(Base):
    __tablename__ = "pm_task"
    __table_args__ = {"schema": "pm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pm.pm_plan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    due_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    task_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    assigned_engineer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mdm_person_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    person_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    person_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    person_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    person_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text())
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )


class PmInspectionTask(Base):
    __tablename__ = "pm_inspection_task"
    __table_args__ = {"schema": "pm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    inspection_type: Mapped[str] = mapped_column(String(64), nullable=False, default="ROUTINE")
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mdm_department_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    department_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    department_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    department_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    task_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    checklist_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    remark: Mapped[str | None] = mapped_column(Text())
    inspector_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mdm_person_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    person_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    person_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    person_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    person_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    person_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inspected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
