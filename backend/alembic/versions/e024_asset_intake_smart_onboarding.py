"""asset intelligent intake onboarding

Revision ID: e024_asset_intake_smart
Revises: e023_asset_mdm_category_ref
Create Date: 2026-05-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "e024_asset_intake_smart"
down_revision = "e023_asset_mdm_category_ref"
branch_labels = None
depends_on = None


ASSET_AI_COLUMNS = [
    ("intake_source", sa.String(length=64)),
    ("ai_extraction_status", sa.String(length=64)),
    ("ai_extraction_confidence", sa.Numeric(5, 2)),
    ("ai_extraction_raw_result", pg.JSONB()),
    ("ai_review_status", sa.String(length=32)),
    ("ai_reviewed_by", sa.String(length=128)),
    ("ai_reviewed_at", sa.DateTime(timezone=True)),
    ("source_file_ids", pg.JSONB()),
    ("evidence_file_ids", pg.JSONB()),
]


def _has_column(bind: sa.engine.Connection, schema: str, table: str, column: str) -> bool:
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table
              AND column_name = :column
            """
        ),
        {"schema": schema, "table": table, "column": column},
    ).first()
    return result is not None


def _has_table(bind: sa.engine.Connection, schema: str, table: str) -> bool:
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_name = :table
            """
        ),
        {"schema": schema, "table": table},
    ).first()
    return result is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e024_asset_intake_smart_onboarding 仅支持 PostgreSQL。")

    for name, coltype in ASSET_AI_COLUMNS:
        if not _has_column(bind, "asset", "asset", name):
            op.add_column("asset", sa.Column(name, coltype, nullable=True), schema="asset")
    op.create_index("ix_asset_asset_ai_review_status", "asset", ["ai_review_status"], schema="asset", if_not_exists=True)

    if not _has_table(bind, "asset", "asset_intake_task"):
        op.create_table(
            "asset_intake_task",
            sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("mode", sa.String(length=64), nullable=False, server_default="single"),
            sa.Column("intake_source", sa.String(length=64), nullable=False, server_default="nameplate_photo"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("ai_extraction_status", sa.String(length=64), nullable=False, server_default="pending"),
            sa.Column("ai_extraction_confidence", sa.Numeric(5, 2), nullable=True),
            sa.Column("ai_extraction_raw_result", pg.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("ai_review_status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("ai_reviewed_by", sa.String(length=128), nullable=True),
            sa.Column("ai_reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("source_file_ids", pg.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("evidence_file_ids", pg.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("extracted_fields", pg.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("mdm_match_result", pg.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("component_structure", pg.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("review_payload", pg.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_asset_id", pg.UUID(as_uuid=True), sa.ForeignKey("asset.asset.id"), nullable=True),
            sa.Column("created_by", sa.String(length=128), nullable=True),
            sa.Column("created_by_name", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            schema="asset",
        )
        op.create_index("ix_asset_intake_task_status", "asset_intake_task", ["status"], schema="asset", if_not_exists=True)
        op.create_index(
            "ix_asset_intake_task_ai_review_status",
            "asset_intake_task",
            ["ai_review_status"],
            schema="asset",
            if_not_exists=True,
        )
        op.create_index(
            "ix_asset_intake_task_created_asset_id",
            "asset_intake_task",
            ["created_asset_id"],
            schema="asset",
            if_not_exists=True,
        )

    if not _has_table(bind, "asset", "asset_intake_file"):
        op.create_table(
            "asset_intake_file",
            sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "task_id",
                pg.UUID(as_uuid=True),
                sa.ForeignKey("asset.asset_intake_task.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("file_type", sa.String(length=64), nullable=False),
            sa.Column("mime_type", sa.String(length=128), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("storage_uri", sa.String(length=500), nullable=True),
            sa.Column("preview_url", sa.String(length=500), nullable=True),
            sa.Column("archive_status", sa.String(length=32), nullable=False, server_default="raw_archived"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            schema="asset",
        )
        op.create_index("ix_asset_intake_file_task_id", "asset_intake_file", ["task_id"], schema="asset", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    if _has_table(bind, "asset", "asset_intake_file"):
        op.drop_index("ix_asset_intake_file_task_id", table_name="asset_intake_file", schema="asset", if_exists=True)
        op.drop_table("asset_intake_file", schema="asset")
    if _has_table(bind, "asset", "asset_intake_task"):
        op.drop_index("ix_asset_intake_task_created_asset_id", table_name="asset_intake_task", schema="asset", if_exists=True)
        op.drop_index("ix_asset_intake_task_ai_review_status", table_name="asset_intake_task", schema="asset", if_exists=True)
        op.drop_index("ix_asset_intake_task_status", table_name="asset_intake_task", schema="asset", if_exists=True)
        op.drop_table("asset_intake_task", schema="asset")

    op.drop_index("ix_asset_asset_ai_review_status", table_name="asset", schema="asset", if_exists=True)
    for name, _coltype in reversed(ASSET_AI_COLUMNS):
        if _has_column(bind, "asset", "asset", name):
            op.drop_column("asset", name, schema="asset")
