"""device classification linkage with H-UMDG

Revision ID: e022_device_class_linkage
Revises: e021_hmdm_external_integration
Create Date: 2026-05-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "e022_device_class_linkage"
down_revision = "e021_hmdm_external_integration"
branch_labels = None
depends_on = None


ASSET_CLASSIFICATION_COLUMNS = [
    ("classification_id", sa.String(length=128)),
    ("classification_code", sa.String(length=128)),
    ("classification_name", sa.String(length=255)),
    ("classification_version_id", sa.String(length=128)),
    ("management_class", sa.String(length=64)),
    ("classification_match_status", sa.String(length=32), sa.text("'unclassified'")),
    ("classification_match_method", sa.String(length=64)),
    ("classification_match_score", sa.Numeric(5, 2)),
    ("classification_confirmed_by", sa.String(length=128)),
    ("classification_confirmed_at", sa.DateTime(timezone=True)),
    ("classification_change_status", sa.String(length=32)),
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
        raise RuntimeError("e022_device_classification_linkage 仅支持 PostgreSQL。")

    for item in ASSET_CLASSIFICATION_COLUMNS:
        name, coltype = item[0], item[1]
        server_default = item[2] if len(item) > 2 else None
        if not _has_column(bind, "asset", "asset", name):
            op.add_column(
                "asset",
                sa.Column(name, coltype, nullable=name != "classification_match_status", server_default=server_default),
                schema="asset",
            )
    op.create_index("ix_asset_classification_id", "asset", ["classification_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_classification_code", "asset", ["classification_code"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_classification_match_status", "asset", ["classification_match_status"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_classification_change_status", "asset", ["classification_change_status"], schema="asset", if_not_exists=True)

    if not _has_table(bind, "asset", "equipment_classification_binding_log"):
        op.create_table(
            "equipment_classification_binding_log",
            sa.Column("log_id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("equipment_id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("old_classification_id", sa.String(length=128), nullable=True),
            sa.Column("old_classification_code", sa.String(length=128), nullable=True),
            sa.Column("new_classification_id", sa.String(length=128), nullable=True),
            sa.Column("new_classification_code", sa.String(length=128), nullable=True),
            sa.Column("classification_version_id", sa.String(length=128), nullable=True),
            sa.Column("action", sa.String(length=64), nullable=False, server_default="bind"),
            sa.Column("match_method", sa.String(length=64), nullable=True),
            sa.Column("match_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("confirm_reason", sa.String(length=500), nullable=True),
            sa.Column("actor_id", sa.String(length=128), nullable=True),
            sa.Column("actor_username", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["equipment_id"], ["asset.asset.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("log_id"),
            schema="asset",
        )
    op.create_index(
        "ix_equipment_classification_binding_log_equipment_id",
        "equipment_classification_binding_log",
        ["equipment_id"],
        schema="asset",
        if_not_exists=True,
    )

    if not _has_table(bind, "asset", "equipment_classification_impact"):
        op.create_table(
            "equipment_classification_impact",
            sa.Column("impact_id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("equipment_id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("old_classification_id", sa.String(length=128), nullable=True),
            sa.Column("old_classification_code", sa.String(length=128), nullable=True),
            sa.Column("new_classification_id", sa.String(length=128), nullable=True),
            sa.Column("change_type", sa.String(length=64), nullable=False),
            sa.Column("impact_level", sa.String(length=16), nullable=False),
            sa.Column("impact_reason", sa.String(length=500), nullable=False),
            sa.Column("source_change_id", sa.String(length=128), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("handled_by", sa.String(length=128), nullable=True),
            sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["equipment_id"], ["asset.asset.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("impact_id"),
            sa.UniqueConstraint("equipment_id", "source_change_id", name="uq_equipment_classification_impact_source"),
            schema="asset",
        )
    op.create_index("ix_equipment_classification_impact_equipment_id", "equipment_classification_impact", ["equipment_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_equipment_classification_impact_source_change_id", "equipment_classification_impact", ["source_change_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_equipment_classification_impact_status", "equipment_classification_impact", ["status"], schema="asset", if_not_exists=True)

    if not _has_table(bind, "integration", "hmdm_classification_change"):
        op.create_table(
            "hmdm_classification_change",
            sa.Column("change_id", sa.String(length=128), nullable=False),
            sa.Column("classification_id", sa.String(length=128), nullable=True),
            sa.Column("classification_code", sa.String(length=128), nullable=True),
            sa.Column("classification_name", sa.String(length=255), nullable=True),
            sa.Column("version_id", sa.String(length=128), nullable=True),
            sa.Column("change_type", sa.String(length=64), nullable=False),
            sa.Column("change_reason", sa.Text(), nullable=True),
            sa.Column("old_payload", pg.JSONB(), nullable=True),
            sa.Column("new_payload", pg.JSONB(), nullable=True),
            sa.Column("target_classification_id", sa.String(length=128), nullable=True),
            sa.Column("target_classification_code", sa.String(length=128), nullable=True),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("change_id"),
            schema="integration",
        )
    op.create_index("ix_hmdm_classification_change_classification_id", "hmdm_classification_change", ["classification_id"], schema="integration", if_not_exists=True)
    op.create_index("ix_hmdm_classification_change_classification_code", "hmdm_classification_change", ["classification_code"], schema="integration", if_not_exists=True)
    op.create_index("ix_hmdm_classification_change_change_type", "hmdm_classification_change", ["change_type"], schema="integration", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_hmdm_classification_change_change_type", table_name="hmdm_classification_change", schema="integration")
    op.drop_index("ix_hmdm_classification_change_classification_code", table_name="hmdm_classification_change", schema="integration")
    op.drop_index("ix_hmdm_classification_change_classification_id", table_name="hmdm_classification_change", schema="integration")
    op.drop_table("hmdm_classification_change", schema="integration")

    op.drop_index("ix_equipment_classification_impact_status", table_name="equipment_classification_impact", schema="asset")
    op.drop_index("ix_equipment_classification_impact_source_change_id", table_name="equipment_classification_impact", schema="asset")
    op.drop_index("ix_equipment_classification_impact_equipment_id", table_name="equipment_classification_impact", schema="asset")
    op.drop_table("equipment_classification_impact", schema="asset")

    op.drop_index("ix_equipment_classification_binding_log_equipment_id", table_name="equipment_classification_binding_log", schema="asset")
    op.drop_table("equipment_classification_binding_log", schema="asset")

    op.drop_index("ix_asset_classification_change_status", table_name="asset", schema="asset")
    op.drop_index("ix_asset_classification_match_status", table_name="asset", schema="asset")
    op.drop_index("ix_asset_classification_code", table_name="asset", schema="asset")
    op.drop_index("ix_asset_classification_id", table_name="asset", schema="asset")
    for item in reversed(ASSET_CLASSIFICATION_COLUMNS):
        op.drop_column("asset", item[0], schema="asset")
