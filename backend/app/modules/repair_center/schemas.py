"""统一报修中心 API 模型 · docs/06 §二。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UnifiedRepairMessageCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source_channel: str = Field(..., max_length=64)
    source_channel_name: str | None = Field(None, max_length=128)
    sender_id: str | None = Field(None, max_length=128)
    sender_name: str | None = Field(None, max_length=128)
    sender_phone: str | None = Field(None, max_length=64)
    sender_department: str | None = Field(None, max_length=128)
    raw_message_type: str = Field(..., max_length=64)
    raw_message_content: str | None = None
    voice_file_url: str | None = None
    image_file_url: str | None = None
    video_file_url: str | None = None
    transcribed_text: str | None = None
    asset_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class UnifiedRepairMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    message_no: str
    source_channel: str
    source_channel_name: str | None = None
    sender_id: str | None = None
    sender_name: str | None = None
    sender_phone: str | None = None
    sender_department: str | None = None
    raw_message_type: str
    raw_message_content: str | None = None
    voice_file_url: str | None = None
    image_file_url: str | None = None
    video_file_url: str | None = None
    transcribed_text: str | None = None
    ai_extracted_department: str | None = None
    ai_extracted_location: str | None = None
    ai_extracted_device_name: str | None = None
    ai_extracted_fault_description: str | None = None
    ai_extracted_urgency: str | None = None
    matched_device_id: UUID | None = None
    matched_confidence: Decimal | None = None
    confirm_status: str
    converted_order_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AiExtractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    message_id: UUID
    session_id: UUID | None = None
    extracted_json: dict[str, Any]
    extracted_department: str | None = None
    extracted_location: str | None = None
    extracted_device_name: str | None = None
    extracted_fault_description: str | None = None
    extracted_fault_category: str | None = None
    extracted_urgency: str | None = None
    affects_clinical_use: bool | None = None
    suspected_emergency_device: bool | None = None
    suspected_life_support_device: bool | None = None
    matched_device_candidates: dict[str, Any] | None = None
    matched_device_id: UUID | None = None
    matched_confidence: Decimal | None = None
    confirmation_strategy: str | None = None
    human_review_status: str
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


ConfirmAction = Literal["CREATE_ORDER", "SELECT_DEVICE", "NEED_MORE_INFO", "MANUAL_REVIEW", "IGNORE"]


class MessageConfirmBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    confirm_action: ConfirmAction
    selected_device_id: UUID | None = None
    fault_description: str | None = None
    urgency: str | None = Field(None, max_length=64)
    affects_clinical_use: bool | None = None
    comment: str | None = Field(None, max_length=1000)


class AssignReviewerBody(BaseModel):
    reviewer_id: UUID
    comment: str | None = Field(None, max_length=1000)


class AiSessionCreate(BaseModel):
    source_channel: str = "AI_CHAT"
    user_name: str | None = Field(None, max_length=128)
    current_intent: str | None = Field("REPAIR_REPORT", max_length=64)


class AiSessionMessageCreate(BaseModel):
    raw_message_type: str = Field("TEXT", max_length=64)
    content: str | None = None
    voice_file_url: str | None = None
    image_file_url: str | None = None
    action: str | None = Field(None, max_length=64)


class ChannelConfigCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    channel_name: str = Field(..., max_length=128)
    channel_type: str = Field(..., max_length=64)
    enabled: bool = True
    robot_name: str | None = Field(None, max_length=128)
    webhook_url: str | None = None
    token_secret: str | None = None
    callback_url: str | None = None
    supported_message_types: dict[str, Any] | None = None
    default_rule_code: str | None = Field(None, max_length=64)
    bound_department_scope: dict[str, Any] | None = None
    bound_user_scope: dict[str, Any] | None = None
    allow_auto_create_order: bool = False
    require_manual_confirm: bool = True
    metadata: dict[str, Any] | None = None


class ChannelConfigPatch(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    channel_name: str | None = Field(None, max_length=128)
    enabled: bool | None = None
    robot_name: str | None = Field(None, max_length=128)
    webhook_url: str | None = None
    token_secret: str | None = None
    callback_url: str | None = None
    supported_message_types: dict[str, Any] | None = None
    default_rule_code: str | None = Field(None, max_length=64)
    bound_department_scope: dict[str, Any] | None = None
    bound_user_scope: dict[str, Any] | None = None
    allow_auto_create_order: bool | None = None
    require_manual_confirm: bool | None = None
    metadata: dict[str, Any] | None = None


class RuleConfigPatch(BaseModel):
    allow_ai_auto_create_order: bool | None = None
    channel_confirm_rules: dict[str, Any] | None = None
    emergency_auto_upgrade: bool | None = None
    night_shift_notify: bool | None = None
    night_shift_time_range: str | None = Field(None, max_length=64)
    dispatch_timeout_minutes: int | None = Field(None, ge=1, le=24 * 60)
    acceptance_timeout_hours: int | None = Field(None, ge=1, le=24 * 30)
    high_value_notify_threshold: Decimal | None = None
    repeat_repair_window_days: int | None = Field(None, ge=1, le=365)
    repeat_repair_threshold: int | None = Field(None, ge=1, le=50)
    life_support_spare_hint: bool | None = None
    allow_clinical_progress_view: bool | None = None
    metadata: dict[str, Any] | None = None

