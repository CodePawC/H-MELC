"""operation center screen access tables

Revision ID: e019_operation_center
Revises: e018_metrology_core
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e019_operation_center"
down_revision = "e018_metrology_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS operation_center")

    op.create_table(
        "screen_access_key",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key_name", sa.String(length=128), nullable=False),
        sa.Column("screen_code", sa.String(length=64), nullable=False),
        sa.Column("access_key", sa.String(length=160), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("allowed_ips", sa.Text(), nullable=True),
        sa.Column("desensitized", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("refresh_interval_seconds", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("carousel_interval_seconds", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_access_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_username", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("access_key"),
        schema="operation_center",
    )
    op.create_index("ix_screen_access_key_access_key", "screen_access_key", ["access_key"], unique=False, schema="operation_center")
    op.create_index("ix_screen_access_key_screen_code", "screen_access_key", ["screen_code"], unique=False, schema="operation_center")

    op.create_table(
        "screen_terminal",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("terminal_name", sa.String(length=128), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("screen_code", sa.String(length=64), nullable=False),
        sa.Column("access_key_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolution", sa.String(length=64), nullable=False, server_default="1920x1080"),
        sa.Column("online_status", sa.String(length=32), nullable=False, server_default="OFFLINE"),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["access_key_id"], ["operation_center.screen_access_key.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="operation_center",
    )
    op.create_index("ix_screen_terminal_access_key_id", "screen_terminal", ["access_key_id"], unique=False, schema="operation_center")
    op.create_index("ix_screen_terminal_screen_code", "screen_terminal", ["screen_code"], unique=False, schema="operation_center")

    op.create_table(
        "screen_access_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("access_time", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("access_ip", sa.String(length=64), nullable=True),
        sa.Column("screen_code", sa.String(length=64), nullable=False),
        sa.Column("access_key", sa.String(length=160), nullable=False),
        sa.Column("access_key_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("terminal_name", sa.String(length=128), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="operation_center",
    )
    op.create_index("ix_screen_access_log_access_ip", "screen_access_log", ["access_ip"], unique=False, schema="operation_center")
    op.create_index("ix_screen_access_log_access_key", "screen_access_log", ["access_key"], unique=False, schema="operation_center")
    op.create_index("ix_screen_access_log_screen_code", "screen_access_log", ["screen_code"], unique=False, schema="operation_center")
    op.create_index("ix_screen_access_log_success", "screen_access_log", ["success"], unique=False, schema="operation_center")


def downgrade() -> None:
    op.drop_index("ix_screen_access_log_success", table_name="screen_access_log", schema="operation_center")
    op.drop_index("ix_screen_access_log_screen_code", table_name="screen_access_log", schema="operation_center")
    op.drop_index("ix_screen_access_log_access_key", table_name="screen_access_log", schema="operation_center")
    op.drop_index("ix_screen_access_log_access_ip", table_name="screen_access_log", schema="operation_center")
    op.drop_table("screen_access_log", schema="operation_center")
    op.drop_index("ix_screen_terminal_screen_code", table_name="screen_terminal", schema="operation_center")
    op.drop_index("ix_screen_terminal_access_key_id", table_name="screen_terminal", schema="operation_center")
    op.drop_table("screen_terminal", schema="operation_center")
    op.drop_index("ix_screen_access_key_screen_code", table_name="screen_access_key", schema="operation_center")
    op.drop_index("ix_screen_access_key_access_key", table_name="screen_access_key", schema="operation_center")
    op.drop_table("screen_access_key", schema="operation_center")
    op.execute("DROP SCHEMA IF EXISTS operation_center")

