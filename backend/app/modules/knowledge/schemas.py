"""知识库模型。"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KbDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    source_type: str
    object_key: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    created_by_user_id: UUID | None = None
    created_at: datetime


class KnowledgeChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(..., min_length=1, max_length=8000)
    scope: str = Field(default="repair", max_length=64)
