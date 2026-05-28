"""工作流 API 模型。

对齐 docs/06_接口设计/01 §八。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowStartBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    process_key: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=512)
    payload: dict[str, Any] = Field(default_factory=dict)
    first_assignee_user_id: UUID | None = None


class WorkflowTaskOutcomeBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    comment: str | None = Field(None, max_length=4096)
