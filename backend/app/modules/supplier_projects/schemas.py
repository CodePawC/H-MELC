"""supplier-projects REST 模型。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProcurementProjectCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=512)
    summary: str | None = Field(None, max_length=8000)
    repair_order_id: UUID | None = None
    bid_deadline: datetime | None = None


class ProcurementProjectReviewBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    remark: str | None = Field(None, max_length=4000)
    decision: Literal["CLOSED", "CANCELLED"] = Field(
        default="CLOSED",
        description="CLOSED 收官；CANCELLED 废止该项目，均不再接受门户报价。",
    )
    winning_bid_id: UUID | None = Field(
        default=None,
        description="中选报价 id（仅 CLOSED 时可传入，须隶属于本项目）。",
    )


class ProcurementBidCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    quoted_amount: Decimal = Field(..., gt=Decimal("0"))
    remark: str | None = Field(None, max_length=4000)


class ProcurementProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    summary: str | None = None
    repair_order_id: UUID | None = None
    status: str
    publisher_user_id: UUID
    bid_deadline: datetime | None = None
    review_remark: str | None = None
    reviewed_at: datetime | None = None
    reviewer_user_id: UUID | None = None
    winning_bid_id: UUID | None = None
    created_at: datetime

