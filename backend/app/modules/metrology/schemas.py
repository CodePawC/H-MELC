"""计量与合规 API 模型 · docs/06 · 十一。"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


RegulatoryClass = Literal["GENERAL", "STRONG_CHECK", "RADIOLOGY", "RADIATION_SAFETY", "PRESSURE_VESSEL"]
CalibrationStatus = Literal["NORMAL", "SOON", "EXPIRED", "SENT", "COMPLETED"]
PlanStatus = Literal["PLANNED", "SENT", "COMPLETED", "CANCELLED"]


class MetrologyDeviceUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: UUID
    regulatory_class: RegulatoryClass = "GENERAL"
    calibration_status: CalibrationStatus = "NORMAL"
    meter_type: str | None = Field(default=None, max_length=64)
    cycle_months: int = Field(default=12, ge=1, le=120)
    last_calibrated_at: date | None = None
    next_due_date: date | None = None
    issuing_body: str | None = Field(default=None, max_length=255)
    remark: str | None = Field(default=None, max_length=4000)


class MetrologyDeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    regulatory_class: str
    calibration_status: str
    meter_type: str | None
    cycle_months: int
    last_calibrated_at: date | None
    next_due_date: date | None
    issuing_body: str | None
    remark: str | None
    created_at: datetime
    updated_at: datetime


class CalibrationPlanUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: UUID
    title: str = Field(..., min_length=1, max_length=512)
    planned_date: date
    plan_status: PlanStatus = "PLANNED"
    assigned_org: str | None = Field(default=None, max_length=255)
    remark: str | None = Field(default=None, max_length=4000)


class CalibrationPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    title: str
    planned_date: date
    plan_status: str
    assigned_org: str | None
    remark: str | None
    created_at: datetime
    updated_at: datetime


class MetrologyCertificateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: UUID
    certificate_no: str = Field(..., min_length=1, max_length=128)
    issued_at: date | None = None
    valid_to: date
    issuing_body: str | None = Field(default=None, max_length=255)
    conclusion: str = Field(default="PASS", max_length=64)
    object_key: str | None = Field(default=None, max_length=1024)
    mime_type: str | None = Field(default=None, max_length=128)
    file_size: int | None = Field(default=None, ge=0)


class MetrologyCertificateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    certificate_no: str
    issued_at: date | None
    valid_to: date
    issuing_body: str | None
    conclusion: str
    object_key: str | None
    mime_type: str | None
    file_size: int | None
    created_at: datetime
