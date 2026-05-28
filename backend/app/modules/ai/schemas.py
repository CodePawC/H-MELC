"""AI 网关请求/响应模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class AiTaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    task_type: Annotated[
        Literal[
            "REPAIR_TRIAGE",
            "REPAIR_REPORT",
            "INVOICE_OCR",
            "DELIVERY_OCR",
            "PAYMENT_PRIORITY",
            "INCIDENT_ANALYSIS",
            "ROI_ANALYSIS",
        ],
        Field(..., description="与《API接口设计》§六·1 任务类型表一致"),
    ]
    payload: dict[str, Any] = Field(default_factory=dict)


class AiTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_type: str
    status: str
    input_payload: dict[str, Any]
    error_message: str | None = None
    result_id: UUID | None = None
    created_at: datetime


class AiResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    output_payload: dict[str, Any]
    review_status: str
    review_comment: str | None = None
    reviewed_by_user_id: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class AiResultReviewBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    confirm_status: Annotated[
        Literal["ACCEPTED", "REJECTED"],
        Field(..., description="人工确认 §六·4"),
    ]
    comment: str | None = Field(None, max_length=4096)
