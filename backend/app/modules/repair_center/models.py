"""统一报修中心 ORM · schema `repair`。

入口消息与正式工单拆分：多渠道消息先落 `unified_repair_message`，确认后生成
`repair.repair_order`。
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UnifiedRepairMessage(Base):
    __tablename__ = "unified_repair_message"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_no: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    source_channel: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_channel_name: Mapped[str | None] = mapped_column(String(128))
    sender_id: Mapped[str | None] = mapped_column(String(128))
    sender_name: Mapped[str | None] = mapped_column(String(128))
    sender_phone: Mapped[str | None] = mapped_column(String(64))
    sender_department: Mapped[str | None] = mapped_column(String(128), index=True)
    raw_message_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_message_content: Mapped[str | None] = mapped_column(Text())
    voice_file_url: Mapped[str | None] = mapped_column(Text())
    image_file_url: Mapped[str | None] = mapped_column(Text())
    video_file_url: Mapped[str | None] = mapped_column(Text())
    transcribed_text: Mapped[str | None] = mapped_column(Text())
    ai_extracted_department: Mapped[str | None] = mapped_column(String(128))
    ai_extracted_location: Mapped[str | None] = mapped_column(String(255))
    ai_extracted_device_name: Mapped[str | None] = mapped_column(String(255))
    ai_extracted_fault_description: Mapped[str | None] = mapped_column(Text())
    ai_extracted_urgency: Mapped[str | None] = mapped_column(String(64))
    matched_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="SET NULL"), index=True
    )
    matched_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    confirm_status: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING", index=True)
    converted_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    message_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairChannelConfig(Base):
    __tablename__ = "repair_channel_config"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_name: Mapped[str] = mapped_column(String(128), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    robot_name: Mapped[str | None] = mapped_column(String(128))
    webhook_url: Mapped[str | None] = mapped_column(Text())
    token_secret: Mapped[str | None] = mapped_column(Text())
    callback_url: Mapped[str | None] = mapped_column(Text())
    supported_message_types: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    default_rule_code: Mapped[str | None] = mapped_column(String(64))
    bound_department_scope: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    bound_user_scope: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    allow_auto_create_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    require_manual_confirm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    channel_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairOrderLog(Base):
    __tablename__ = "repair_order_log"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(64))
    to_status: Mapped[str | None] = mapped_column(String(64))
    action: Mapped[str | None] = mapped_column(String(64), index=True)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    operator_name: Mapped[str | None] = mapped_column(String(128))
    content: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    log_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairDispatch(Base):
    __tablename__ = "repair_dispatch"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dispatcher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    dispatcher_name: Mapped[str | None] = mapped_column(String(128))
    engineer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    engineer_name: Mapped[str | None] = mapped_column(String(128))
    dispatch_status: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING_DISPATCH", index=True)
    dispatch_reason: Mapped[str | None] = mapped_column(Text())
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    dispatch_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairResult(Base):
    __tablename__ = "repair_result"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    fault_cause: Mapped[str | None] = mapped_column(Text())
    repair_method: Mapped[str | None] = mapped_column(Text())
    replaced_parts: Mapped[str | None] = mapped_column(Text())
    test_result: Mapped[str | None] = mapped_column(Text())
    conclusion: Mapped[str | None] = mapped_column(Text())
    actual_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    downtime_minutes: Mapped[int | None] = mapped_column(Integer)
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ai_result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    result_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairAcceptance(Base):
    __tablename__ = "repair_acceptance"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    acceptance_status: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING", index=True)
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    accepted_by_name: Mapped[str | None] = mapped_column(String(128))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    satisfaction_score: Mapped[int | None] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    acceptance_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairAiSession(Base):
    __tablename__ = "repair_ai_session"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_no: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    channel_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.unified_repair_message.id", ondelete="SET NULL")
    )
    source_channel: Mapped[str | None] = mapped_column(String(64))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    user_name: Mapped[str | None] = mapped_column(String(128))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    session_status: Mapped[str] = mapped_column(String(64), nullable=False, default="ACTIVE")
    current_intent: Mapped[str | None] = mapped_column(String(64))
    last_question: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    session_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairAiExtractResult(Base):
    __tablename__ = "repair_ai_extract_result"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.unified_repair_message.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_ai_session.id", ondelete="SET NULL")
    )
    extracted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    extracted_department: Mapped[str | None] = mapped_column(String(128))
    extracted_location: Mapped[str | None] = mapped_column(String(255))
    extracted_device_name: Mapped[str | None] = mapped_column(String(255))
    extracted_fault_description: Mapped[str | None] = mapped_column(Text())
    extracted_fault_category: Mapped[str | None] = mapped_column(String(128))
    extracted_urgency: Mapped[str | None] = mapped_column(String(64))
    affects_clinical_use: Mapped[bool | None] = mapped_column(Boolean)
    suspected_emergency_device: Mapped[bool | None] = mapped_column(Boolean)
    suspected_life_support_device: Mapped[bool | None] = mapped_column(Boolean)
    matched_device_candidates: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    matched_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.asset.id", ondelete="SET NULL")
    )
    matched_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    confirmation_strategy: Mapped[str | None] = mapped_column(String(64))
    human_review_status: Mapped[str] = mapped_column(String(64), nullable=False, default="PENDING")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    result_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairRuleConfig(Base):
    __tablename__ = "repair_rule_config"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    rule_name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_ai_auto_create_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    channel_confirm_rules: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    emergency_auto_upgrade: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    night_shift_notify: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    night_shift_time_range: Mapped[str | None] = mapped_column(String(64))
    dispatch_timeout_minutes: Mapped[int | None] = mapped_column(Integer)
    acceptance_timeout_hours: Mapped[int | None] = mapped_column(Integer)
    high_value_notify_threshold: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    repeat_repair_window_days: Mapped[int | None] = mapped_column(Integer)
    repeat_repair_threshold: Mapped[int | None] = mapped_column(Integer)
    life_support_spare_hint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_clinical_progress_view: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), server_onupdate=func.now()
    )
    rule_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class RepairNotificationLog(Base):
    __tablename__ = "repair_notification_log"
    __table_args__ = {"schema": "repair"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.unified_repair_message.id", ondelete="SET NULL")
    )
    repair_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair.repair_order.id", ondelete="SET NULL")
    )
    channel_type: Mapped[str | None] = mapped_column(String(64))
    notify_target_type: Mapped[str | None] = mapped_column(String(64))
    notify_target_id: Mapped[str | None] = mapped_column(String(128))
    notify_target_name: Mapped[str | None] = mapped_column(String(128))
    notify_content: Mapped[str | None] = mapped_column(Text())
    notify_status: Mapped[str | None] = mapped_column(String(64))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fail_reason: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    notify_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
