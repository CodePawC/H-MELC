"""设备台账请求/响应模型，对齐 docs/06_接口设计/01_API接口设计.md §一."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


_MDM_REFERENCE_FIELDS = (
    "mdm_category_id",
    "mdm_category_code",
    "mdm_category_name",
    "mdm_category_path",
    "mdm_category_version",
)
_DEPARTMENT_REFERENCE_FIELDS = (
    "mdm_department_id",
    "department_code",
    "campus_id",
    "department_version",
)
_PERSON_REFERENCE_FIELDS = (
    "mdm_person_id",
    "person_code",
    "person_name",
    "person_department_id",
    "person_department_name",
    "person_version",
)
_DISCIPLINE_REFERENCE_FIELDS = (
    "mdm_discipline_id",
    "discipline_code",
    "discipline_name",
    "discipline_version",
)
_ORG_REFERENCE_FIELDS = (
    "manufacturer_org_id",
    "supplier_org_id",
    "brand_owner_org_id",
    "registration_holder_org_id",
    "maintainer_org_id",
    "installer_org_id",
    "org_version",
)


class _HmdmReferenceGuard(BaseModel):
    @model_validator(mode="after")
    def _validate_mdm_reference(self):
        source = getattr(self, "mdm_source", None)
        has_reference = any(getattr(self, field, None) for field in _MDM_REFERENCE_FIELDS)
        if source and source != "h-mdm":
            raise ValueError("医疗器械分类目录只能保存来自 H-UMDG 的正式主数据引用")
        if has_reference and source != "h-mdm":
            raise ValueError("保存 H-UMDG 分类引用时 mdm_source 必须为 h-mdm")
        department_source = getattr(self, "department_source", None)
        has_department = any(getattr(self, field, None) for field in _DEPARTMENT_REFERENCE_FIELDS)
        if department_source and department_source != "h-mdm":
            raise ValueError("科室主数据只能保存来自 H-UMDG 的正式主数据引用")
        if has_department and department_source != "h-mdm":
            raise ValueError("保存 H-UMDG 科室引用时 department_source 必须为 h-mdm")
        person_source = getattr(self, "person_source", None)
        has_person = any(getattr(self, field, None) for field in _PERSON_REFERENCE_FIELDS)
        if person_source and person_source != "h-mdm":
            raise ValueError("人员主数据只能保存来自 H-UMDG 的正式主数据引用")
        if has_person and person_source != "h-mdm":
            raise ValueError("保存 H-UMDG 人员引用时 person_source 必须为 h-mdm")
        discipline_source = getattr(self, "discipline_source", None)
        has_discipline = any(getattr(self, field, None) for field in _DISCIPLINE_REFERENCE_FIELDS)
        if discipline_source and discipline_source != "h-mdm":
            raise ValueError("学科主数据只能保存来自 H-UMDG 的正式主数据引用")
        if has_discipline and discipline_source != "h-mdm":
            raise ValueError("保存 H-UMDG 学科引用时 discipline_source 必须为 h-mdm")
        org_source = getattr(self, "org_source", None)
        has_org = any(getattr(self, field, None) for field in _ORG_REFERENCE_FIELDS)
        if org_source and org_source != "h-mdm":
            raise ValueError("单位类主数据只能保存来自 H-UMDG 的正式主数据引用")
        if has_org and org_source != "h-mdm":
            raise ValueError("保存 H-UMDG 往来单位引用时 org_source 必须为 h-mdm")
        return self


class AssetCreate(_HmdmReferenceGuard):
    model_config = ConfigDict(str_strip_whitespace=True)

    asset_code: str = Field(..., max_length=64, description="一机一码唯一编码（业务约束）")
    asset_name: str = Field(..., max_length=255)
    category_code: str | None = Field(None, max_length=64)
    model_id: UUID | None = None
    manufacturer_id: UUID | None = None
    supplier_id: UUID | None = None
    brand: str | None = Field(None, max_length=128)
    model: str | None = Field(None, max_length=128)
    department_name: str | None = Field(None, max_length=255)
    campus_id: str | None = Field(None, max_length=128)
    campus_code: str | None = Field(None, max_length=128)
    campus_name: str | None = Field(None, max_length=255)
    mdm_department_id: str | None = Field(None, max_length=128)
    department_code: str | None = Field(None, max_length=128)
    department_source: str | None = Field(None, max_length=64)
    department_version: str | None = Field(None, max_length=128)
    department_synced_at: datetime | None = None
    mdm_person_id: str | None = Field(None, max_length=128)
    person_code: str | None = Field(None, max_length=128)
    person_name: str | None = Field(None, max_length=255)
    person_department_id: str | None = Field(None, max_length=128)
    person_department_name: str | None = Field(None, max_length=255)
    person_source: str | None = Field(None, max_length=64)
    person_version: str | None = Field(None, max_length=128)
    person_synced_at: datetime | None = None
    mdm_discipline_id: str | None = Field(None, max_length=128)
    discipline_code: str | None = Field(None, max_length=128)
    discipline_name: str | None = Field(None, max_length=255)
    discipline_source: str | None = Field(None, max_length=64)
    discipline_version: str | None = Field(None, max_length=128)
    discipline_synced_at: datetime | None = None
    location: str | None = Field(None, max_length=255)
    warranty_status: str | None = Field(None, max_length=64)
    hmdm_equipment_category_code: str | None = Field(None, max_length=128)
    hmdm_equipment_category_name: str | None = Field(None, max_length=255)
    hmdm_equipment_name_code: str | None = Field(None, max_length=128)
    hmdm_standard_name: str | None = Field(None, max_length=255)
    hmdm_regulatory_major_category: str | None = Field(None, max_length=128)
    hmdm_primary_product_category: str | None = Field(None, max_length=128)
    hmdm_secondary_product_category: str | None = Field(None, max_length=128)
    hmdm_management_class: str | None = Field(None, max_length=64)
    classification_id: str | None = Field(None, max_length=128)
    classification_code: str | None = Field(None, max_length=128)
    classification_name: str | None = Field(None, max_length=255)
    classification_version_id: str | None = Field(None, max_length=128)
    management_class: str | None = Field(None, max_length=64)
    mdm_category_id: str | None = Field(None, max_length=128)
    mdm_category_code: str | None = Field(None, max_length=128)
    mdm_category_name: str | None = Field(None, max_length=255)
    mdm_category_path: str | None = Field(None, max_length=500)
    mdm_category_version: str | None = Field(None, max_length=128)
    mdm_source: str | None = Field(None, max_length=64)
    mdm_synced_at: datetime | None = None
    intake_source: str | None = Field(None, max_length=64)
    ai_extraction_status: str | None = Field(None, max_length=64)
    ai_extraction_confidence: Decimal | None = None
    ai_extraction_raw_result: dict[str, Any] | None = None
    ai_review_status: str | None = Field(None, max_length=32)
    ai_reviewed_by: str | None = Field(None, max_length=128)
    ai_reviewed_at: datetime | None = None
    source_file_ids: list[str] | None = None
    evidence_file_ids: list[str] | None = None
    classification_match_status: str | None = Field(default="unclassified", max_length=32)
    classification_match_method: str | None = Field(None, max_length=64)
    classification_match_score: Decimal | None = None
    classification_change_status: str | None = Field(None, max_length=32)
    manufacturer_org_code: str | None = Field(None, max_length=128)
    manufacturer_name: str | None = Field(None, max_length=255)
    manufacturer_org_id: str | None = Field(None, max_length=128)
    supplier_org_code: str | None = Field(None, max_length=128)
    supplier_name: str | None = Field(None, max_length=255)
    supplier_org_id: str | None = Field(None, max_length=128)
    after_sales_org_code: str | None = Field(None, max_length=128)
    after_sales_name: str | None = Field(None, max_length=255)
    service_provider_org_code: str | None = Field(None, max_length=128)
    service_provider_name: str | None = Field(None, max_length=255)
    brand_owner_org_id: str | None = Field(None, max_length=128)
    brand_owner_org_code: str | None = Field(None, max_length=128)
    brand_owner_name: str | None = Field(None, max_length=255)
    registration_holder_org_id: str | None = Field(None, max_length=128)
    registration_holder_org_code: str | None = Field(None, max_length=128)
    registration_holder_name: str | None = Field(None, max_length=255)
    maintainer_org_id: str | None = Field(None, max_length=128)
    maintainer_org_code: str | None = Field(None, max_length=128)
    maintainer_name: str | None = Field(None, max_length=255)
    installer_org_id: str | None = Field(None, max_length=128)
    installer_org_code: str | None = Field(None, max_length=128)
    installer_name: str | None = Field(None, max_length=255)
    org_source: str | None = Field(None, max_length=64)
    org_version: str | None = Field(None, max_length=128)
    org_synced_at: datetime | None = None
    serial_number: str | None = Field(None, max_length=128)
    registration_no: str | None = Field(None, max_length=128)
    udi_di: str | None = Field(None, max_length=128)
    udi_pi: str | None = Field(None, max_length=128)
    department_id: UUID | None = None
    location_id: UUID | None = None
    purchase_date: date | None = None
    install_date: date | None = None
    warranty_end: date | None = None
    original_value: Decimal | None = None
    main_status: str = Field(default="ACTIVE", max_length=64)
    lifecycle_phase: str | None = Field(None, max_length=64)
    risk_level: str | None = Field(None, max_length=64)
    regulatory_level: str | None = Field(None, max_length=64)


class AssetUpdate(_HmdmReferenceGuard):
    """部分更新 PUT；未传字段保持原值。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    asset_name: str | None = Field(None, max_length=255)
    category_code: str | None = Field(None, max_length=64)
    model_id: UUID | None = None
    manufacturer_id: UUID | None = None
    supplier_id: UUID | None = None
    brand: str | None = Field(None, max_length=128)
    model: str | None = Field(None, max_length=128)
    department_name: str | None = Field(None, max_length=255)
    campus_id: str | None = Field(None, max_length=128)
    campus_code: str | None = Field(None, max_length=128)
    campus_name: str | None = Field(None, max_length=255)
    mdm_department_id: str | None = Field(None, max_length=128)
    department_code: str | None = Field(None, max_length=128)
    department_source: str | None = Field(None, max_length=64)
    department_version: str | None = Field(None, max_length=128)
    department_synced_at: datetime | None = None
    mdm_person_id: str | None = Field(None, max_length=128)
    person_code: str | None = Field(None, max_length=128)
    person_name: str | None = Field(None, max_length=255)
    person_department_id: str | None = Field(None, max_length=128)
    person_department_name: str | None = Field(None, max_length=255)
    person_source: str | None = Field(None, max_length=64)
    person_version: str | None = Field(None, max_length=128)
    person_synced_at: datetime | None = None
    mdm_discipline_id: str | None = Field(None, max_length=128)
    discipline_code: str | None = Field(None, max_length=128)
    discipline_name: str | None = Field(None, max_length=255)
    discipline_source: str | None = Field(None, max_length=64)
    discipline_version: str | None = Field(None, max_length=128)
    discipline_synced_at: datetime | None = None
    location: str | None = Field(None, max_length=255)
    warranty_status: str | None = Field(None, max_length=64)
    hmdm_equipment_category_code: str | None = Field(None, max_length=128)
    hmdm_equipment_category_name: str | None = Field(None, max_length=255)
    hmdm_equipment_name_code: str | None = Field(None, max_length=128)
    hmdm_standard_name: str | None = Field(None, max_length=255)
    hmdm_regulatory_major_category: str | None = Field(None, max_length=128)
    hmdm_primary_product_category: str | None = Field(None, max_length=128)
    hmdm_secondary_product_category: str | None = Field(None, max_length=128)
    hmdm_management_class: str | None = Field(None, max_length=64)
    classification_id: str | None = Field(None, max_length=128)
    classification_code: str | None = Field(None, max_length=128)
    classification_name: str | None = Field(None, max_length=255)
    classification_version_id: str | None = Field(None, max_length=128)
    management_class: str | None = Field(None, max_length=64)
    mdm_category_id: str | None = Field(None, max_length=128)
    mdm_category_code: str | None = Field(None, max_length=128)
    mdm_category_name: str | None = Field(None, max_length=255)
    mdm_category_path: str | None = Field(None, max_length=500)
    mdm_category_version: str | None = Field(None, max_length=128)
    mdm_source: str | None = Field(None, max_length=64)
    mdm_synced_at: datetime | None = None
    intake_source: str | None = Field(None, max_length=64)
    ai_extraction_status: str | None = Field(None, max_length=64)
    ai_extraction_confidence: Decimal | None = None
    ai_extraction_raw_result: dict[str, Any] | None = None
    ai_review_status: str | None = Field(None, max_length=32)
    ai_reviewed_by: str | None = Field(None, max_length=128)
    ai_reviewed_at: datetime | None = None
    source_file_ids: list[str] | None = None
    evidence_file_ids: list[str] | None = None
    classification_match_status: str | None = Field(None, max_length=32)
    classification_match_method: str | None = Field(None, max_length=64)
    classification_match_score: Decimal | None = None
    classification_change_status: str | None = Field(None, max_length=32)
    manufacturer_org_code: str | None = Field(None, max_length=128)
    manufacturer_name: str | None = Field(None, max_length=255)
    manufacturer_org_id: str | None = Field(None, max_length=128)
    supplier_org_code: str | None = Field(None, max_length=128)
    supplier_name: str | None = Field(None, max_length=255)
    supplier_org_id: str | None = Field(None, max_length=128)
    after_sales_org_code: str | None = Field(None, max_length=128)
    after_sales_name: str | None = Field(None, max_length=255)
    service_provider_org_code: str | None = Field(None, max_length=128)
    service_provider_name: str | None = Field(None, max_length=255)
    brand_owner_org_id: str | None = Field(None, max_length=128)
    brand_owner_org_code: str | None = Field(None, max_length=128)
    brand_owner_name: str | None = Field(None, max_length=255)
    registration_holder_org_id: str | None = Field(None, max_length=128)
    registration_holder_org_code: str | None = Field(None, max_length=128)
    registration_holder_name: str | None = Field(None, max_length=255)
    maintainer_org_id: str | None = Field(None, max_length=128)
    maintainer_org_code: str | None = Field(None, max_length=128)
    maintainer_name: str | None = Field(None, max_length=255)
    installer_org_id: str | None = Field(None, max_length=128)
    installer_org_code: str | None = Field(None, max_length=128)
    installer_name: str | None = Field(None, max_length=255)
    org_source: str | None = Field(None, max_length=64)
    org_version: str | None = Field(None, max_length=128)
    org_synced_at: datetime | None = None
    serial_number: str | None = Field(None, max_length=128)
    registration_no: str | None = Field(None, max_length=128)
    udi_di: str | None = Field(None, max_length=128)
    udi_pi: str | None = Field(None, max_length=128)
    department_id: UUID | None = None
    location_id: UUID | None = None
    purchase_date: date | None = None
    install_date: date | None = None
    warranty_end: date | None = None
    original_value: Decimal | None = None
    main_status: str | None = Field(None, max_length=64)
    lifecycle_phase: str | None = Field(None, max_length=64)
    risk_level: str | None = Field(None, max_length=64)
    regulatory_level: str | None = Field(None, max_length=64)
    is_active: bool | None = None


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_code: str
    asset_name: str
    category_code: str | None = None
    model_id: UUID | None = None
    manufacturer_id: UUID | None = None
    supplier_id: UUID | None = None
    brand: str | None = None
    model: str | None = None
    department_name: str | None = None
    campus_id: str | None = None
    campus_code: str | None = None
    campus_name: str | None = None
    mdm_department_id: str | None = None
    department_code: str | None = None
    department_source: str | None = None
    department_version: str | None = None
    department_synced_at: datetime | None = None
    mdm_person_id: str | None = None
    person_code: str | None = None
    person_name: str | None = None
    person_department_id: str | None = None
    person_department_name: str | None = None
    person_source: str | None = None
    person_version: str | None = None
    person_synced_at: datetime | None = None
    mdm_discipline_id: str | None = None
    discipline_code: str | None = None
    discipline_name: str | None = None
    discipline_source: str | None = None
    discipline_version: str | None = None
    discipline_synced_at: datetime | None = None
    location: str | None = None
    warranty_status: str | None = None
    hmdm_equipment_category_code: str | None = None
    hmdm_equipment_category_name: str | None = None
    hmdm_equipment_name_code: str | None = None
    hmdm_standard_name: str | None = None
    hmdm_regulatory_major_category: str | None = None
    hmdm_primary_product_category: str | None = None
    hmdm_secondary_product_category: str | None = None
    hmdm_management_class: str | None = None
    classification_id: str | None = None
    classification_code: str | None = None
    classification_name: str | None = None
    classification_version_id: str | None = None
    management_class: str | None = None
    mdm_category_id: str | None = None
    mdm_category_code: str | None = None
    mdm_category_name: str | None = None
    mdm_category_path: str | None = None
    mdm_category_version: str | None = None
    mdm_source: str | None = None
    mdm_synced_at: datetime | None = None
    intake_source: str | None = None
    ai_extraction_status: str | None = None
    ai_extraction_confidence: Decimal | None = None
    ai_extraction_raw_result: dict[str, Any] | None = None
    ai_review_status: str | None = None
    ai_reviewed_by: str | None = None
    ai_reviewed_at: datetime | None = None
    source_file_ids: list[str] | None = None
    evidence_file_ids: list[str] | None = None
    classification_match_status: str = "unclassified"
    classification_match_method: str | None = None
    classification_match_score: Decimal | None = None
    classification_confirmed_by: str | None = None
    classification_confirmed_at: datetime | None = None
    classification_change_status: str | None = None
    manufacturer_org_code: str | None = None
    manufacturer_name: str | None = None
    manufacturer_org_id: str | None = None
    supplier_org_code: str | None = None
    supplier_name: str | None = None
    supplier_org_id: str | None = None
    after_sales_org_code: str | None = None
    after_sales_name: str | None = None
    service_provider_org_code: str | None = None
    service_provider_name: str | None = None
    brand_owner_org_id: str | None = None
    brand_owner_org_code: str | None = None
    brand_owner_name: str | None = None
    registration_holder_org_id: str | None = None
    registration_holder_org_code: str | None = None
    registration_holder_name: str | None = None
    maintainer_org_id: str | None = None
    maintainer_org_code: str | None = None
    maintainer_name: str | None = None
    installer_org_id: str | None = None
    installer_org_code: str | None = None
    installer_name: str | None = None
    org_source: str | None = None
    org_version: str | None = None
    org_synced_at: datetime | None = None
    serial_number: str | None = None
    registration_no: str | None = None
    udi_di: str | None = None
    udi_pi: str | None = None
    department_id: UUID | None = None
    location_id: UUID | None = None
    purchase_date: date | None = None
    install_date: date | None = None
    warranty_end: date | None = None
    original_value: Decimal | None = None
    main_status: str
    lifecycle_phase: str | None = None
    risk_level: str | None = None
    regulatory_level: str | None = None
    ai_health_score: Decimal | None = None
    usage_score: Decimal | None = None
    roi_score: Decimal | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class QrRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    qr_token: str
    qr_version: int
    status: str
    generated_at: datetime
    expired_at: datetime | None = None


class AssetListPagination(BaseModel):
    items: list[AssetRead]
    total: int
    page: int
    page_size: int


class AssetIntakeTaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(None, max_length=255)
    mode: str = Field(default="single", max_length=64)
    intake_source: str = Field(default="nameplate_photo", max_length=64)


class AssetIntakeFileCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    file_name: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=64)
    mime_type: str | None = Field(None, max_length=128)
    size_bytes: int | None = Field(None, ge=0)
    storage_uri: str | None = Field(None, max_length=500)
    preview_url: str | None = Field(None, max_length=500)


class AssetIntakeFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    file_name: str
    file_type: str
    mime_type: str | None = None
    size_bytes: int | None = None
    storage_uri: str | None = None
    preview_url: str | None = None
    archive_status: str
    created_at: datetime


class AssetIntakeTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    mode: str
    intake_source: str
    status: str
    ai_extraction_status: str
    ai_extraction_confidence: Decimal | None = None
    ai_extraction_raw_result: dict[str, Any] = Field(default_factory=dict)
    ai_review_status: str
    ai_reviewed_by: str | None = None
    ai_reviewed_at: datetime | None = None
    source_file_ids: list[str] = Field(default_factory=list)
    evidence_file_ids: list[str] = Field(default_factory=list)
    extracted_fields: dict[str, Any] = Field(default_factory=dict)
    mdm_match_result: dict[str, Any] = Field(default_factory=dict)
    component_structure: list[dict[str, Any]] = Field(default_factory=list)
    review_payload: dict[str, Any] = Field(default_factory=dict)
    created_asset_id: UUID | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    files: list[AssetIntakeFileRead] = Field(default_factory=list)


class AssetIntakeReviewRequest(BaseModel):
    review_payload: dict[str, Any] = Field(default_factory=dict)
    selected_mdm_category: dict[str, Any] | None = None
    review_status: str = Field(default="pending_review", max_length=32)


class AssetIntakeApproveRequest(BaseModel):
    review_comment: str | None = Field(None, max_length=500)


class AssetIntakeCreateAssetRequest(BaseModel):
    asset_code: str | None = Field(None, max_length=64)


class ClassificationBindRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    classification_id: str = Field(..., alias="classificationId", max_length=128)
    classification_code: str = Field(..., alias="classificationCode", max_length=128)
    classification_name: str | None = Field(None, alias="classificationName", max_length=255)
    classification_version_id: str = Field(..., alias="classificationVersionId", max_length=128)
    management_class: str | None = Field(None, alias="managementClass", max_length=64)
    confirm_reason: str | None = Field(None, alias="confirmReason", max_length=500)
    match_method: str = Field(default="manual_confirmed", alias="matchMethod", max_length=64)
    match_score: Decimal | None = Field(None, alias="matchScore")


class ClassificationImpactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    impact_id: UUID
    equipment_id: UUID
    old_classification_id: str | None = None
    old_classification_code: str | None = None
    new_classification_id: str | None = None
    change_type: str
    impact_level: str
    impact_reason: str
    source_change_id: str
    status: str
    created_at: datetime
    handled_by: str | None = None
    handled_at: datetime | None = None


class ClassificationImpactSyncRequest(BaseModel):
    since: datetime | None = None


class ClassificationImpactHandleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    handle_reason: str | None = Field(None, alias="handleReason", max_length=500)


class ClassificationImpactAdjustRequest(ClassificationBindRequest):
    handle_reason: str | None = Field(None, alias="handleReason", max_length=500)


class ScanAssetRequest(BaseModel):
    qr_token: str = Field(..., min_length=8, description="二维码 token")


class ScanAssetResponse(BaseModel):
    """扫码解析：`docs/06_接口设计` §一·6 返回依权限裁剪；占位阶段一次性返回概要。"""

    asset_id: UUID
    asset_code: str
    asset_name: str
    main_status: str


class JcPrinterDrawingBoard(BaseModel):
    """精臣 PC Web SDK 画板初始化参数。单位为毫米。"""

    width: float
    height: float
    rotate: Literal[0, 90, 180, 270] = 0
    path: str = "ZT001.ttf"
    verticalShift: float = 0
    HorizontalShift: float = 0


class JcPrinterElement(BaseModel):
    """精臣 PC Web SDK 绘制元素。"""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["text", "qrCode", "barCode", "line", "graph", "image"]
    payload: dict[str, Any] = Field(..., alias="json")


class JcPrinterPrintData(BaseModel):
    """精臣 PC Web SDK 单页打印数据。"""

    InitDrawingBoardParam: JcPrinterDrawingBoard
    elements: list[JcPrinterElement]


class JcPrinterTemplateMeta(BaseModel):
    template_code: str
    template_name: str
    paper_type_code: str
    paper_type_name: str
    layout_code: str
    layout_name: str
    label_width_mm: float
    label_height_mm: float
    display_scale: float = Field(default=8, description="预览比例；200dpi 标签机通常使用 8")
    print_density: int = Field(default=3, ge=1, le=15)
    print_label_type: int = Field(default=1, description="1=间隙纸，见精臣 SDK 文档")
    print_mode: int = Field(default=1, description="1=热敏，2=热转印")


class AssetLabelTemplatePreset(JcPrinterTemplateMeta):
    """设备标签模板预设：纸张类型、纸张大小与版式统一由平台控制。"""

    description: str
    is_default: bool = False


class AssetLabelTemplateListResponse(BaseModel):
    items: list[AssetLabelTemplatePreset]
    default_template_code: str


class JcPrinterSdkMeta(BaseModel):
    package_version: str
    service_ws_url: str
    service_required: bool = True
    service_installer_hint: str
    integration_mode: str


class AssetPrintLabelResponse(BaseModel):
    """设备标签打印载荷：平台生成标签内容，PC 管理端调用精臣本机 SDK 打印。"""

    asset: ScanAssetResponse
    qr: dict[str, Any]
    sdk: JcPrinterSdkMeta
    template: JcPrinterTemplateMeta
    print_data: JcPrinterPrintData
