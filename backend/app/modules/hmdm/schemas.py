from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HmdmStatusResponse(BaseModel):
    hmdm_base_url: str
    connected: bool
    last_success_at: datetime | None = None
    last_failure_reason: str | None = None
    api_key_configured: bool
    cache_enabled: bool
    cache_status: dict[str, Any]


class HmdmCacheStatusResponse(BaseModel):
    cache_enabled: bool
    fallback_to_cache: bool
    ttl_seconds: int
    counts: dict[str, int]
    latest_synced_at: datetime | None = None
    expired_count: int = 0


class EquipmentStandardNameRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proposed_name: str = Field(..., max_length=255)
    alias_names: list[str] = Field(default_factory=list)
    suggested_category: str | None = Field(None, max_length=255)
    reason: str = Field(..., min_length=2)


class ManufacturerVendorRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proposed_standard_name: str = Field(..., max_length=255)
    english_name: str | None = Field(None, max_length=255)
    short_name: str | None = Field(None, max_length=128)
    alias_names: list[str] = Field(default_factory=list)
    unified_social_credit_code: str | None = Field(None, max_length=64)
    suggested_role_type: str | None = Field(None, max_length=64)
    business_domain: str | None = Field(None, max_length=64)
    contact_info: dict[str, Any] | None = None
    reason: str = Field(..., min_length=2)


class RequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    submitted_by: str
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class DeviceClassificationMatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    device_name: str = Field(..., alias="deviceName", max_length=255)
    brand: str | None = Field(None, max_length=128)
    model: str | None = Field(None, max_length=128)
    registration_name: str | None = Field(None, alias="registrationName", max_length=255)
    registration_certificate_no: str | None = Field(None, alias="registrationCertificateNo", max_length=128)
    management_class: str | None = Field(None, alias="managementClass", max_length=64)
    department: str | None = Field(None, max_length=255)
    intended_use: str | None = Field(None, alias="intendedUse", max_length=500)
    original_category: str | None = Field(None, alias="originalCategory", max_length=255)


class DeviceClassificationCandidate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    classification_id: str = Field(..., alias="classificationId")
    classification_code: str = Field(..., alias="classificationCode")
    catalog_item: str = Field(..., alias="catalogItem")
    management_class: str | None = Field(None, alias="managementClass")
    match_score: int = Field(..., alias="matchScore", ge=0, le=100)
    match_reason: str = Field(..., alias="matchReason")
    version_id: str | None = Field(None, alias="versionId")
    product_description: str | None = Field(None, alias="productDescription")
    intended_use: str | None = Field(None, alias="intendedUse")
    examples: list[str] = Field(default_factory=list)


class DeviceClassificationMatchResponse(BaseModel):
    candidates: list[DeviceClassificationCandidate]
    source: str
    degraded: bool = False


class DeviceClassificationChangeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    change_id: str | None = Field(None, alias="changeId", max_length=128)
    classification_id: str | None = Field(None, alias="classificationId", max_length=128)
    classification_code: str | None = Field(None, alias="classificationCode", max_length=128)
    classification_name: str | None = Field(None, alias="classificationName", max_length=255)
    version_id: str | None = Field(None, alias="versionId", max_length=128)
    change_type: str = Field(..., alias="changeType", max_length=64)
    change_reason: str | None = Field(None, alias="changeReason", max_length=500)
    old_payload: dict[str, Any] | None = Field(None, alias="oldPayload")
    new_payload: dict[str, Any] | None = Field(None, alias="newPayload")
    target_classification_id: str | None = Field(None, alias="targetClassificationId", max_length=128)
    target_classification_code: str | None = Field(None, alias="targetClassificationCode", max_length=128)
    occurred_at: datetime | None = Field(None, alias="occurredAt")


class DeviceClassificationChangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    change_id: str = Field(..., alias="changeId")
    classification_id: str | None = Field(None, alias="classificationId")
    classification_code: str | None = Field(None, alias="classificationCode")
    classification_name: str | None = Field(None, alias="classificationName")
    version_id: str | None = Field(None, alias="versionId")
    change_type: str = Field(..., alias="changeType")
    change_reason: str | None = Field(None, alias="changeReason")
    old_payload: dict[str, Any] | None = Field(None, alias="oldPayload")
    new_payload: dict[str, Any] | None = Field(None, alias="newPayload")
    target_classification_id: str | None = Field(None, alias="targetClassificationId")
    target_classification_code: str | None = Field(None, alias="targetClassificationCode")
    occurred_at: datetime = Field(..., alias="occurredAt")
