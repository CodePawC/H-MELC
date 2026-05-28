"""asset mdm category reference fields

Revision ID: e023_asset_mdm_category_ref
Revises: e022_device_class_linkage
Create Date: 2026-05-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e023_asset_mdm_category_ref"
down_revision = "e022_device_class_linkage"
branch_labels = None
depends_on = None


MDM_REFERENCE_COLUMNS = [
    ("mdm_category_id", sa.String(length=128)),
    ("mdm_category_code", sa.String(length=128)),
    ("mdm_category_name", sa.String(length=255)),
    ("mdm_category_path", sa.String(length=500)),
    ("mdm_category_version", sa.String(length=128)),
    ("mdm_source", sa.String(length=64)),
    ("mdm_synced_at", sa.DateTime(timezone=True)),
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


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e023_asset_mdm_category_reference 仅支持 PostgreSQL。")

    for name, coltype in MDM_REFERENCE_COLUMNS:
        if not _has_column(bind, "asset", "asset", name):
            op.add_column("asset", sa.Column(name, coltype, nullable=True), schema="asset")

    op.create_index("ix_asset_mdm_category_id", "asset", ["mdm_category_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_mdm_category_code", "asset", ["mdm_category_code"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_mdm_source", "asset", ["mdm_source"], schema="asset", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_asset_mdm_source", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_mdm_category_code", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_mdm_category_id", table_name="asset", schema="asset", if_exists=True)
    for name, _coltype in reversed(MDM_REFERENCE_COLUMNS):
        if _has_column(bind, "asset", "asset", name):
            op.drop_column("asset", name, schema="asset")
