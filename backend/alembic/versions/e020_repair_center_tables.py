"""unified repair center tables

Revision ID: e020_repair_center
Revises: e019_operation_center
Create Date: 2026-05-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "e020_repair_center"
down_revision = "e019_operation_center"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e020_repair_center 仅支持 PostgreSQL（需 repair / asset schema）。")

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS repair"))

    op.create_table(
        "unified_repair_message",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("message_no", sa.String(length=64), nullable=False),
        sa.Column("source_channel", sa.String(length=64), nullable=False),
        sa.Column("source_channel_name", sa.String(length=128), nullable=True),
        sa.Column("sender_id", sa.String(length=128), nullable=True),
        sa.Column("sender_name", sa.String(length=128), nullable=True),
        sa.Column("sender_phone", sa.String(length=64), nullable=True),
        sa.Column("sender_department", sa.String(length=128), nullable=True),
        sa.Column("raw_message_type", sa.String(length=64), nullable=False),
        sa.Column("raw_message_content", sa.Text(), nullable=True),
        sa.Column("voice_file_url", sa.Text(), nullable=True),
        sa.Column("image_file_url", sa.Text(), nullable=True),
        sa.Column("video_file_url", sa.Text(), nullable=True),
        sa.Column("transcribed_text", sa.Text(), nullable=True),
        sa.Column("ai_extracted_department", sa.String(length=128), nullable=True),
        sa.Column("ai_extracted_location", sa.String(length=255), nullable=True),
        sa.Column("ai_extracted_device_name", sa.String(length=255), nullable=True),
        sa.Column("ai_extracted_fault_description", sa.Text(), nullable=True),
        sa.Column("ai_extracted_urgency", sa.String(length=64), nullable=True),
        sa.Column("matched_device_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("matched_confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("confirm_status", sa.String(length=64), nullable=False, server_default="PENDING"),
        sa.Column("converted_order_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["converted_order_id"], ["repair.repair_order.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["matched_device_id"], ["asset.asset.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_no"),
        schema="repair",
    )
    op.create_index("ix_unified_repair_message_message_no", "unified_repair_message", ["message_no"], schema="repair")
    op.create_index("ix_unified_repair_message_source_channel", "unified_repair_message", ["source_channel"], schema="repair")
    op.create_index("ix_unified_repair_message_sender_department", "unified_repair_message", ["sender_department"], schema="repair")
    op.create_index("ix_unified_repair_message_raw_message_type", "unified_repair_message", ["raw_message_type"], schema="repair")
    op.create_index("ix_unified_repair_message_matched_device_id", "unified_repair_message", ["matched_device_id"], schema="repair")
    op.create_index("ix_unified_repair_message_confirm_status", "unified_repair_message", ["confirm_status"], schema="repair")
    op.create_index("ix_unified_repair_message_converted_order_id", "unified_repair_message", ["converted_order_id"], schema="repair")
    op.create_index("ix_unified_repair_message_created_at", "unified_repair_message", ["created_at"], schema="repair")

    op.create_table(
        "repair_channel_config",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("channel_name", sa.String(length=128), nullable=False),
        sa.Column("channel_type", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("robot_name", sa.String(length=128), nullable=True),
        sa.Column("webhook_url", sa.Text(), nullable=True),
        sa.Column("token_secret", sa.Text(), nullable=True),
        sa.Column("callback_url", sa.Text(), nullable=True),
        sa.Column("supported_message_types", pg.JSONB(), nullable=True),
        sa.Column("default_rule_code", sa.String(length=64), nullable=True),
        sa.Column("bound_department_scope", pg.JSONB(), nullable=True),
        sa.Column("bound_user_scope", pg.JSONB(), nullable=True),
        sa.Column("allow_auto_create_order", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("require_manual_confirm", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="repair",
    )
    op.create_index("ix_repair_channel_config_channel_type", "repair_channel_config", ["channel_type"], schema="repair")

    op.create_table(
        "repair_order_log",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sa.String(length=64), nullable=True),
        sa.Column("to_status", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=True),
        sa.Column("operator_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("operator_name", sa.String(length=128), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["repair_order_id"], ["repair.repair_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="repair",
    )
    op.create_index("ix_repair_order_log_repair_order_id", "repair_order_log", ["repair_order_id"], schema="repair")
    op.create_index("ix_repair_order_log_action", "repair_order_log", ["action"], schema="repair")

    op.create_table(
        "repair_dispatch",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("dispatcher_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("dispatcher_name", sa.String(length=128), nullable=True),
        sa.Column("engineer_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("engineer_name", sa.String(length=128), nullable=True),
        sa.Column("dispatch_status", sa.String(length=64), nullable=False, server_default="PENDING_DISPATCH"),
        sa.Column("dispatch_reason", sa.Text(), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["repair_order_id"], ["repair.repair_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="repair",
    )
    op.create_index("ix_repair_dispatch_repair_order_id", "repair_dispatch", ["repair_order_id"], schema="repair")
    op.create_index("ix_repair_dispatch_engineer_id", "repair_dispatch", ["engineer_id"], schema="repair")
    op.create_index("ix_repair_dispatch_dispatch_status", "repair_dispatch", ["dispatch_status"], schema="repair")

    op.create_table(
        "repair_result",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("fault_cause", sa.Text(), nullable=True),
        sa.Column("repair_method", sa.Text(), nullable=True),
        sa.Column("replaced_parts", sa.Text(), nullable=True),
        sa.Column("test_result", sa.Text(), nullable=True),
        sa.Column("conclusion", sa.Text(), nullable=True),
        sa.Column("actual_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("downtime_minutes", sa.Integer(), nullable=True),
        sa.Column("ai_generated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ai_result_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["repair_order_id"], ["repair.repair_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("repair_order_id"),
        schema="repair",
    )

    op.create_table(
        "repair_acceptance",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("acceptance_status", sa.String(length=64), nullable=False, server_default="PENDING"),
        sa.Column("accepted_by", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("accepted_by_name", sa.String(length=128), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("satisfaction_score", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["repair_order_id"], ["repair.repair_order.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("repair_order_id"),
        schema="repair",
    )
    op.create_index("ix_repair_acceptance_acceptance_status", "repair_acceptance", ["acceptance_status"], schema="repair")

    op.create_table(
        "repair_ai_session",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("session_no", sa.String(length=64), nullable=False),
        sa.Column("channel_message_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("source_channel", sa.String(length=64), nullable=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("user_name", sa.String(length=128), nullable=True),
        sa.Column("department_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("session_status", sa.String(length=64), nullable=False, server_default="ACTIVE"),
        sa.Column("current_intent", sa.String(length=64), nullable=True),
        sa.Column("last_question", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["channel_message_id"], ["repair.unified_repair_message.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_no"),
        schema="repair",
    )
    op.create_index("ix_repair_ai_session_session_no", "repair_ai_session", ["session_no"], schema="repair")

    op.create_table(
        "repair_ai_extract_result",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("extracted_json", pg.JSONB(), nullable=False),
        sa.Column("extracted_department", sa.String(length=128), nullable=True),
        sa.Column("extracted_location", sa.String(length=255), nullable=True),
        sa.Column("extracted_device_name", sa.String(length=255), nullable=True),
        sa.Column("extracted_fault_description", sa.Text(), nullable=True),
        sa.Column("extracted_fault_category", sa.String(length=128), nullable=True),
        sa.Column("extracted_urgency", sa.String(length=64), nullable=True),
        sa.Column("affects_clinical_use", sa.Boolean(), nullable=True),
        sa.Column("suspected_emergency_device", sa.Boolean(), nullable=True),
        sa.Column("suspected_life_support_device", sa.Boolean(), nullable=True),
        sa.Column("matched_device_candidates", pg.JSONB(), nullable=True),
        sa.Column("matched_device_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("matched_confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("confirmation_strategy", sa.String(length=64), nullable=True),
        sa.Column("human_review_status", sa.String(length=64), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["matched_device_id"], ["asset.asset.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["message_id"], ["repair.unified_repair_message.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["repair.repair_ai_session.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="repair",
    )
    op.create_index("ix_repair_ai_extract_result_message_id", "repair_ai_extract_result", ["message_id"], schema="repair")
    op.create_index("ix_repair_ai_extract_result_created_at", "repair_ai_extract_result", ["created_at"], schema="repair")

    op.create_table(
        "repair_rule_config",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_code", sa.String(length=64), nullable=False),
        sa.Column("rule_name", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("allow_ai_auto_create_order", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("channel_confirm_rules", pg.JSONB(), nullable=True),
        sa.Column("emergency_auto_upgrade", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("night_shift_notify", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("night_shift_time_range", sa.String(length=64), nullable=True),
        sa.Column("dispatch_timeout_minutes", sa.Integer(), nullable=True),
        sa.Column("acceptance_timeout_hours", sa.Integer(), nullable=True),
        sa.Column("high_value_notify_threshold", sa.Numeric(14, 2), nullable=True),
        sa.Column("repeat_repair_window_days", sa.Integer(), nullable=True),
        sa.Column("repeat_repair_threshold", sa.Integer(), nullable=True),
        sa.Column("life_support_spare_hint", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("allow_clinical_progress_view", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rule_code"),
        schema="repair",
    )

    op.create_table(
        "repair_notification_log",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("channel_type", sa.String(length=64), nullable=True),
        sa.Column("notify_target_type", sa.String(length=64), nullable=True),
        sa.Column("notify_target_id", sa.String(length=128), nullable=True),
        sa.Column("notify_target_name", sa.String(length=128), nullable=True),
        sa.Column("notify_content", sa.Text(), nullable=True),
        sa.Column("notify_status", sa.String(length=64), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fail_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", pg.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["message_id"], ["repair.unified_repair_message.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["repair_order_id"], ["repair.repair_order.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="repair",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_table("repair_notification_log", schema="repair")
    op.drop_table("repair_rule_config", schema="repair")
    op.drop_index("ix_repair_ai_extract_result_created_at", table_name="repair_ai_extract_result", schema="repair")
    op.drop_index("ix_repair_ai_extract_result_message_id", table_name="repair_ai_extract_result", schema="repair")
    op.drop_table("repair_ai_extract_result", schema="repair")
    op.drop_index("ix_repair_ai_session_session_no", table_name="repair_ai_session", schema="repair")
    op.drop_table("repair_ai_session", schema="repair")
    op.drop_index("ix_repair_acceptance_acceptance_status", table_name="repair_acceptance", schema="repair")
    op.drop_table("repair_acceptance", schema="repair")
    op.drop_table("repair_result", schema="repair")
    op.drop_index("ix_repair_dispatch_dispatch_status", table_name="repair_dispatch", schema="repair")
    op.drop_index("ix_repair_dispatch_engineer_id", table_name="repair_dispatch", schema="repair")
    op.drop_index("ix_repair_dispatch_repair_order_id", table_name="repair_dispatch", schema="repair")
    op.drop_table("repair_dispatch", schema="repair")
    op.drop_index("ix_repair_order_log_action", table_name="repair_order_log", schema="repair")
    op.drop_index("ix_repair_order_log_repair_order_id", table_name="repair_order_log", schema="repair")
    op.drop_table("repair_order_log", schema="repair")
    op.drop_index("ix_repair_channel_config_channel_type", table_name="repair_channel_config", schema="repair")
    op.drop_table("repair_channel_config", schema="repair")
    op.drop_index("ix_unified_repair_message_created_at", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_converted_order_id", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_confirm_status", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_matched_device_id", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_raw_message_type", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_sender_department", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_source_channel", table_name="unified_repair_message", schema="repair")
    op.drop_index("ix_unified_repair_message_message_no", table_name="unified_repair_message", schema="repair")
    op.drop_table("unified_repair_message", schema="repair")
