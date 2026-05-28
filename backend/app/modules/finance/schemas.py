"""财务请求体验证。

对齐 docs/06_接口设计/01 §五·6、§八（付款优先级 AI）。
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class PaymentAllocationIn(BaseModel):
    """§五·6 `allocations` 单项：`invoice_id` 与 `payable_id` 二选一。"""

    invoice_id: UUID | None = None
    payable_id: UUID | None = None
    allocated_amount: Decimal = Field(..., gt=Decimal("0"))

    @model_validator(mode="after")
    def exactly_one_target(self) -> PaymentAllocationIn:
        has_inv = self.invoice_id is not None
        has_pay = self.payable_id is not None
        if has_inv == has_pay:
            raise ValueError("每项 allocation 必须且仅能指定 invoice_id 或 payable_id 之一")
        return self


class PaymentRegisterBody(BaseModel):
    """§五·6"""

    supplier_id: UUID = Field(..., description="对齐 supplier.organization.id")
    payment_amount: Decimal = Field(..., gt=Decimal("0"))
    payment_date: date
    allocations: list[PaymentAllocationIn] = Field(..., min_length=1)

    @field_validator("payment_amount")
    @classmethod
    def two_decimals_budget(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class PaymentPriorityBody(BaseModel):
    """§五·8 · 可按供应商过滤待发队列。"""

    supplier_id: UUID | None = None


class PayableCreateBody(BaseModel):
    """院内补录应付款台账行（与 §五·5 列表字段一致；文档 §五·5 旁补充说明）。"""

    supplier_id: UUID | None = Field(default=None, description="同 supplier.organization.id")
    organization_id: UUID | None = Field(default=None, description="与 supplier_id 等价，二选一")
    title: str = Field(..., min_length=1, max_length=512)
    amount_due: Decimal = Field(..., gt=Decimal("0"))
    due_date: date | None = None

    @field_validator("amount_due")
    @classmethod
    def amount_two_decimals(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def one_org_key(self) -> PayableCreateBody:
        a = self.supplier_id is not None
        b = self.organization_id is not None
        if a == b:
            raise ValueError("必须且仅能指定 supplier_id 或 organization_id 之一")
        return self

    @property
    def resolved_organization_id(self) -> UUID:
        if self.supplier_id is not None:
            return self.supplier_id
        assert self.organization_id is not None
        return self.organization_id
