"""H-UMDG 引用缓存与候选申请表。

边界：缓存不是权威库；新增申请只是候选数据，后续同步给 H-UMDG 审核发布。
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HmdmDictionaryCache(Base):
    __tablename__ = "hmdm_dictionary_cache"
    __table_args__ = (
        UniqueConstraint("source_type", "source_code", name="uq_hmdm_dictionary_cache_source"),
        {"schema": "integration"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_code: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EquipmentStandardNameRequest(Base):
    __tablename__ = "equipment_standard_name_request"
    __table_args__ = {"schema": "integration"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposed_name: Mapped[str] = mapped_column(String(255), nullable=False)
    alias_names: Mapped[list | None] = mapped_column(JSONB)
    suggested_category: Mapped[str | None] = mapped_column(String(255))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by: Mapped[str] = mapped_column(String(128), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ManufacturerVendorRequest(Base):
    __tablename__ = "manufacturer_vendor_request"
    __table_args__ = {"schema": "integration"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposed_standard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    english_name: Mapped[str | None] = mapped_column(String(255))
    short_name: Mapped[str | None] = mapped_column(String(128))
    alias_names: Mapped[list | None] = mapped_column(JSONB)
    unified_social_credit_code: Mapped[str | None] = mapped_column(String(64))
    suggested_role_type: Mapped[str | None] = mapped_column(String(64))
    business_domain: Mapped[str | None] = mapped_column(String(64))
    contact_info: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by: Mapped[str] = mapped_column(String(128), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class HmdmClassificationChange(Base):
    __tablename__ = "hmdm_classification_change"
    __table_args__ = {"schema": "integration"}

    change_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    classification_id: Mapped[str | None] = mapped_column(String(128), index=True)
    classification_code: Mapped[str | None] = mapped_column(String(128), index=True)
    classification_name: Mapped[str | None] = mapped_column(String(255))
    version_id: Mapped[str | None] = mapped_column(String(128))
    change_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    change_reason: Mapped[str | None] = mapped_column(Text)
    old_payload: Mapped[dict | None] = mapped_column(JSONB)
    new_payload: Mapped[dict | None] = mapped_column(JSONB)
    target_classification_id: Mapped[str | None] = mapped_column(String(128))
    target_classification_code: Mapped[str | None] = mapped_column(String(128))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
