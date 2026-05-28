"""报修维修 API 形状，对齐 docs/06_接口设计/01_API接口设计.md §二。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RepairAttachmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    file_id: UUID
    file_type: str | None = Field(None, max_length=64)
    description: str | None = None


class RepairCreate(BaseModel):
    """§二·科室扫码报修（文本/多媒体以 file_id 引用对象存储预留）。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    asset_id: UUID
    fault_description: str | None = None
    fault_type: str | None = Field(None, max_length=64)
    fault_level: str | None = Field(None, max_length=32)
    priority: str | None = Field(None, max_length=32)
    report_department_id: UUID | None = None
    reporter_id: UUID | None = None
    reporter_name: str | None = Field(None, max_length=128)
    reporter_phone: str | None = Field(None, max_length=64)
    attachments: list[RepairAttachmentCreate] = Field(default_factory=list)


class RepairOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_code: str
    asset_id: UUID
    report_department_id: UUID | None = None
    reporter_id: UUID | None = None
    reporter_name: str | None = None
    reporter_phone: str | None = None
    fault_description: str | None = None
    fault_type: str | None = None
    fault_level: str | None = None
    priority: str | None = None
    order_status: str
    assigned_engineer_id: UUID | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    confirmed_at: datetime | None = None
    is_outsourced: bool = False
    is_return_factory: bool = False
    is_chargeable: bool = False
    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    ai_risk_level: str | None = None
    ai_incident_suggestion: bool = False
    created_at: datetime
    updated_at: datetime


class RepairAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    repair_order_id: UUID
    file_id: UUID
    file_type: str | None = None
    description: str | None = None
    uploaded_by: UUID | None = None
    uploaded_at: datetime


class RepairRecordRead(BaseModel):
    """由 service 拼装；ORM 字段为 record_metadata → JSON metadata。"""

    id: UUID
    repair_order_id: UUID
    record_type: str | None = None
    content: str | None = None
    engineer_id: UUID | None = None
    engineer_name: str | None = None
    ai_assisted: bool = False
    ai_result_id: UUID | None = None
    created_at: datetime
    metadata: dict[str, object] | None = None


class RepairReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    repair_order_id: UUID
    fault_cause: str | None = None
    repair_method: str | None = None
    replaced_parts: str | None = None
    test_result: str | None = None
    conclusion: str | None = None
    ai_generated: bool = False
    ai_result_id: UUID | None = None
    department_confirm_status: str | None = None
    department_confirm_by: UUID | None = None
    department_confirm_at: datetime | None = None
    created_at: datetime


class RepairDetailBundle(BaseModel):
    order: RepairOrderRead
    attachments: list[RepairAttachmentRead]
    records: list[RepairRecordRead]
    report: RepairReportRead | None = None


class RepairClaimBody(BaseModel):
    engineer_id: UUID


class RepairAssignBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    engineer_id: UUID
    reason: str | None = Field(None, max_length=500)


class RepairRecordCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    record_type: str | None = Field("NOTE", max_length=64)
    content: str | None = None
    engineer_id: UUID | None = None
    engineer_name: str | None = Field(None, max_length=128)


class RepairCompleteBody(BaseModel):
    """§二·7 完成维修时写入初步报告正文。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    fault_cause: str | None = None
    repair_method: str | None = None
    replaced_parts: str | None = None
    test_result: str | None = None
    conclusion: str | None = None
    actual_cost: Decimal | None = None


ConfirmStatusLiteral = Literal["ACCEPTED", "REJECTED"]


class RepairConfirmBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    confirm_status: Annotated[ConfirmStatusLiteral, Field(description="§二·科室确认 ACCEPTED | REJECTED")]
    department_confirm_by: UUID | None = None
    comment: str | None = None


class RepairOrderListResponse(BaseModel):
    items: list[RepairOrderRead]
    total: int
    page: int
    page_size: int
