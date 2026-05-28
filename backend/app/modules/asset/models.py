"""设备资产 ORM，对齐 docs/03_数据库设计/04_核心表结构设计.md · 二、1 与 4。

使用 PostgreSQL schema `asset`；SQLite 下本模块仅用于类型与声明，业务迁移在 Alembic 中对 PG 执行。
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Asset(Base):
    __tablename__ = "asset"
    __table_args__ = {"schema": "asset"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str | None] = mapped_column(String(64))
    model_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    manufacturer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    brand: Mapped[str | None] = mapped_column(String(128))
    model: Mapped[str | None] = mapped_column(String(128))
    department_name: Mapped[str | None] = mapped_column(String(255))
    campus_id: Mapped[str | None] = mapped_column(String(128), index=True)
    campus_code: Mapped[str | None] = mapped_column(String(128))
    campus_name: Mapped[str | None] = mapped_column(String(255))
    mdm_department_id: Mapped[str | None] = mapped_column(String(128), index=True)
    department_code: Mapped[str | None] = mapped_column(String(128), index=True)
    department_source: Mapped[str | None] = mapped_column(String(64), index=True)
    department_version: Mapped[str | None] = mapped_column(String(128))
    department_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mdm_person_id: Mapped[str | None] = mapped_column(String(128), index=True)
    person_code: Mapped[str | None] = mapped_column(String(128))
    person_name: Mapped[str | None] = mapped_column(String(255))
    person_department_id: Mapped[str | None] = mapped_column(String(128))
    person_department_name: Mapped[str | None] = mapped_column(String(255))
    person_source: Mapped[str | None] = mapped_column(String(64))
    person_version: Mapped[str | None] = mapped_column(String(128))
    person_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mdm_discipline_id: Mapped[str | None] = mapped_column(String(128), index=True)
    discipline_code: Mapped[str | None] = mapped_column(String(128))
    discipline_name: Mapped[str | None] = mapped_column(String(255))
    discipline_source: Mapped[str | None] = mapped_column(String(64))
    discipline_version: Mapped[str | None] = mapped_column(String(128))
    discipline_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    location: Mapped[str | None] = mapped_column(String(255))
    warranty_status: Mapped[str | None] = mapped_column(String(64))
    # H-UMDG 是外部权威主数据系统；以下字段仅保存 H-UMDG 返回的引用编码和快照名称。
    hmdm_equipment_category_code: Mapped[str | None] = mapped_column(String(128))
    hmdm_equipment_category_name: Mapped[str | None] = mapped_column(String(255))
    hmdm_equipment_name_code: Mapped[str | None] = mapped_column(String(128))
    hmdm_standard_name: Mapped[str | None] = mapped_column(String(255))
    hmdm_regulatory_major_category: Mapped[str | None] = mapped_column(String(128))
    hmdm_primary_product_category: Mapped[str | None] = mapped_column(String(128))
    hmdm_secondary_product_category: Mapped[str | None] = mapped_column(String(128))
    hmdm_management_class: Mapped[str | None] = mapped_column(String(64))
    classification_id: Mapped[str | None] = mapped_column(String(128))
    classification_code: Mapped[str | None] = mapped_column(String(128), index=True)
    classification_name: Mapped[str | None] = mapped_column(String(255))
    classification_version_id: Mapped[str | None] = mapped_column(String(128))
    management_class: Mapped[str | None] = mapped_column(String(64))
    mdm_category_id: Mapped[str | None] = mapped_column(String(128), index=True)
    mdm_category_code: Mapped[str | None] = mapped_column(String(128), index=True)
    mdm_category_name: Mapped[str | None] = mapped_column(String(255))
    mdm_category_path: Mapped[str | None] = mapped_column(String(500))
    mdm_category_version: Mapped[str | None] = mapped_column(String(128))
    mdm_source: Mapped[str | None] = mapped_column(String(64), index=True)
    mdm_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    intake_source: Mapped[str | None] = mapped_column(String(64))
    ai_extraction_status: Mapped[str | None] = mapped_column(String(64))
    ai_extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ai_extraction_raw_result: Mapped[dict | None] = mapped_column(JSONB)
    ai_review_status: Mapped[str | None] = mapped_column(String(32), index=True)
    ai_reviewed_by: Mapped[str | None] = mapped_column(String(128))
    ai_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_file_ids: Mapped[list | None] = mapped_column(JSONB)
    evidence_file_ids: Mapped[list | None] = mapped_column(JSONB)
    classification_match_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unclassified")
    classification_match_method: Mapped[str | None] = mapped_column(String(64))
    classification_match_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    classification_confirmed_by: Mapped[str | None] = mapped_column(String(128))
    classification_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    classification_change_status: Mapped[str | None] = mapped_column(String(32))
    manufacturer_org_code: Mapped[str | None] = mapped_column(String(128))
    manufacturer_name: Mapped[str | None] = mapped_column(String(255))
    manufacturer_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    supplier_org_code: Mapped[str | None] = mapped_column(String(128))
    supplier_name: Mapped[str | None] = mapped_column(String(255))
    supplier_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    after_sales_org_code: Mapped[str | None] = mapped_column(String(128))
    after_sales_name: Mapped[str | None] = mapped_column(String(255))
    service_provider_org_code: Mapped[str | None] = mapped_column(String(128))
    service_provider_name: Mapped[str | None] = mapped_column(String(255))
    brand_owner_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    brand_owner_org_code: Mapped[str | None] = mapped_column(String(128))
    brand_owner_name: Mapped[str | None] = mapped_column(String(255))
    registration_holder_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    registration_holder_org_code: Mapped[str | None] = mapped_column(String(128))
    registration_holder_name: Mapped[str | None] = mapped_column(String(255))
    maintainer_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    maintainer_org_code: Mapped[str | None] = mapped_column(String(128))
    maintainer_name: Mapped[str | None] = mapped_column(String(255))
    installer_org_id: Mapped[str | None] = mapped_column(String(128), index=True)
    installer_org_code: Mapped[str | None] = mapped_column(String(128))
    installer_name: Mapped[str | None] = mapped_column(String(255))
    org_source: Mapped[str | None] = mapped_column(String(64), index=True)
    org_version: Mapped[str | None] = mapped_column(String(128))
    org_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    serial_number: Mapped[str | None] = mapped_column(String(128))
    registration_no: Mapped[str | None] = mapped_column(String(128))
    udi_di: Mapped[str | None] = mapped_column(String(128))
    udi_pi: Mapped[str | None] = mapped_column(String(128))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    install_date: Mapped[date | None] = mapped_column(Date)
    warranty_end: Mapped[date | None] = mapped_column(Date)
    original_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    main_status: Mapped[str] = mapped_column(String(64), nullable=False, default="ACTIVE")
    lifecycle_phase: Mapped[str | None] = mapped_column(String(64))
    risk_level: Mapped[str | None] = mapped_column(String(64))
    regulatory_level: Mapped[str | None] = mapped_column(String(64))
    ai_health_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    usage_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    roi_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    qrcodes: Mapped[list["AssetQrCode"]] = relationship(
        "AssetQrCode", back_populates="asset", cascade="all, delete-orphan"
    )
    classification_impacts: Mapped[list["EquipmentClassificationImpact"]] = relationship(
        "EquipmentClassificationImpact", back_populates="asset", cascade="all, delete-orphan"
    )


class AssetIntakeTask(Base):
    __tablename__ = "asset_intake_task"
    __table_args__ = {"schema": "asset"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(String(64), nullable=False, default="single")
    intake_source: Mapped[str] = mapped_column(String(64), nullable=False, default="nameplate_photo")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    ai_extraction_status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending")
    ai_extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ai_extraction_raw_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ai_review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    ai_reviewed_by: Mapped[str | None] = mapped_column(String(128))
    ai_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_file_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    evidence_file_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    extracted_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    mdm_match_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    component_structure: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    review_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("asset.asset.id"))
    created_by: Mapped[str | None] = mapped_column(String(128))
    created_by_name: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    files: Mapped[list["AssetIntakeFile"]] = relationship(
        "AssetIntakeFile", back_populates="task", cascade="all, delete-orphan"
    )


class AssetIntakeFile(Base):
    __tablename__ = "asset_intake_file"
    __table_args__ = {"schema": "asset"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset_intake_task.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    storage_uri: Mapped[str | None] = mapped_column(String(500))
    preview_url: Mapped[str | None] = mapped_column(String(500))
    archive_status: Mapped[str] = mapped_column(String(32), nullable=False, default="raw_archived")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task: Mapped["AssetIntakeTask"] = relationship("AssetIntakeTask", back_populates="files")


class AssetQrCode(Base):
    __tablename__ = "asset_qrcode"
    __table_args__ = {"schema": "asset"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, index=True
    )
    qr_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    qr_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    asset: Mapped["Asset"] = relationship("Asset", back_populates="qrcodes")


class EquipmentClassificationBindingLog(Base):
    __tablename__ = "equipment_classification_binding_log"
    __table_args__ = {"schema": "asset"}

    log_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, index=True
    )
    old_classification_id: Mapped[str | None] = mapped_column(String(128))
    old_classification_code: Mapped[str | None] = mapped_column(String(128))
    new_classification_id: Mapped[str | None] = mapped_column(String(128))
    new_classification_code: Mapped[str | None] = mapped_column(String(128))
    classification_version_id: Mapped[str | None] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(64), nullable=False, default="bind")
    match_method: Mapped[str | None] = mapped_column(String(64))
    match_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    confirm_reason: Mapped[str | None] = mapped_column(String(500))
    actor_id: Mapped[str | None] = mapped_column(String(128))
    actor_username: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EquipmentClassificationImpact(Base):
    __tablename__ = "equipment_classification_impact"
    __table_args__ = (
        UniqueConstraint("equipment_id", "source_change_id", name="uq_equipment_classification_impact_source"),
        {"schema": "asset"},
    )

    impact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="CASCADE"), nullable=False, index=True
    )
    old_classification_id: Mapped[str | None] = mapped_column(String(128))
    old_classification_code: Mapped[str | None] = mapped_column(String(128))
    new_classification_id: Mapped[str | None] = mapped_column(String(128))
    change_type: Mapped[str] = mapped_column(String(64), nullable=False)
    impact_level: Mapped[str] = mapped_column(String(16), nullable=False)
    impact_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    source_change_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    handled_by: Mapped[str | None] = mapped_column(String(128))
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    asset: Mapped["Asset"] = relationship("Asset", back_populates="classification_impacts")
