"""PM API 模型 · docs/06 · 十"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


PmFrequency = Literal["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]
PmPlanStatus = Literal["DRAFT", "ACTIVE", "SUSPENDED", "ENDED"]
PmTaskStatus = Literal["PENDING", "IN_PROGRESS", "DONE", "OVERDUE"]


class PmPlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=512)
    code: str | None = Field(default=None, max_length=64)
    asset_id: UUID
    frequency: PmFrequency
    next_due_date: date
    owner_department_id: UUID | None = None
    mdm_department_id: str | None = Field(default=None, max_length=128)
    department_code: str | None = Field(default=None, max_length=128)
    department_name: str | None = Field(default=None, max_length=255)
    department_source: str | None = Field(default=None, max_length=64)
    department_version: str | None = Field(default=None, max_length=128)
    department_synced_at: datetime | None = None
    description: str | None = Field(default=None, max_length=8000)
    plan_status: PmPlanStatus = "ACTIVE"

    @model_validator(mode="after")
    def _validate_department_ref(self):
        has_ref = any([self.mdm_department_id, self.department_code, self.department_version])
        if self.department_source and self.department_source != "h-mdm":
            raise ValueError("保养计划责任科室只能保存来自 H-UMDG 的正式主数据引用")
        if has_ref and self.department_source != "h-mdm":
            raise ValueError("保存 H-UMDG 科室引用时 department_source 必须为 h-mdm")
        return self


class PmPlanPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=512)
    code: str | None = Field(default=None, max_length=64)
    frequency: PmFrequency | None = None
    next_due_date: date | None = None
    owner_department_id: UUID | None = None
    mdm_department_id: str | None = Field(default=None, max_length=128)
    department_code: str | None = Field(default=None, max_length=128)
    department_name: str | None = Field(default=None, max_length=255)
    department_source: str | None = Field(default=None, max_length=64)
    department_version: str | None = Field(default=None, max_length=128)
    department_synced_at: datetime | None = None
    description: str | None = Field(default=None, max_length=8000)
    plan_status: PmPlanStatus | None = None


class PmPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    code: str | None
    asset_id: UUID
    frequency: str
    next_due_date: date
    owner_department_id: UUID | None
    mdm_department_id: str | None = None
    department_code: str | None = None
    department_name: str | None = None
    department_source: str | None = None
    department_version: str | None = None
    department_synced_at: datetime | None = None
    description: str | None
    plan_status: str
    created_at: datetime
    updated_at: datetime


class PmTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    asset_id: UUID
    due_date: date
    task_status: str
    assigned_engineer_id: UUID | None
    mdm_person_id: str | None = None
    person_code: str | None = None
    person_name: str | None = None
    person_source: str | None = None
    person_version: str | None = None
    person_synced_at: datetime | None = None
    result_summary: str | None
    executed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PmTaskCompleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result_summary: str | None = Field(default=None, max_length=8000)
    executed_at: datetime | None = None
    engineer_id: UUID | None = None
    mdm_person_id: str | None = Field(default=None, max_length=128)
    person_code: str | None = Field(default=None, max_length=128)
    person_name: str | None = Field(default=None, max_length=255)
    person_source: str | None = Field(default=None, max_length=64)
    person_version: str | None = Field(default=None, max_length=128)
    person_synced_at: datetime | None = None

    @model_validator(mode="after")
    def _validate_person_ref(self):
        has_ref = any([self.mdm_person_id, self.person_code, self.person_version])
        if self.person_source and self.person_source != "h-mdm":
            raise ValueError("保养执行人只能保存来自 H-UMDG 的正式主数据引用")
        if has_ref and self.person_source != "h-mdm":
            raise ValueError("保存 H-UMDG 人员引用时 person_source 必须为 h-mdm")
        return self


class PmInspectionRecordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checklist_result: dict[str, Any]
    remark: str | None = Field(default=None, max_length=8000)
    inspector_id: UUID | None = None


class PmInspectionTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    inspection_type: str
    department_id: UUID | None
    mdm_department_id: str | None = None
    department_code: str | None = None
    department_name: str | None = None
    department_source: str | None = None
    department_version: str | None = None
    department_synced_at: datetime | None = None
    asset_id: UUID | None
    due_date: date
    task_status: str
    checklist_result: dict[str, Any] | None
    remark: str | None
    inspector_id: UUID | None
    mdm_person_id: str | None = None
    person_code: str | None = None
    person_name: str | None = None
    person_source: str | None = None
    person_version: str | None = None
    person_synced_at: datetime | None = None
    inspected_at: datetime | None
    created_at: datetime
    updated_at: datetime
