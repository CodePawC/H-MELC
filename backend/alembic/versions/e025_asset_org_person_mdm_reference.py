"""asset organization and person mdm reference fields

Revision ID: e025_asset_org_person_mdm_ref
Revises: e024_asset_intake_smart
Create Date: 2026-05-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e025_asset_org_person_mdm_ref"
down_revision = "e024_asset_intake_smart"
branch_labels = None
depends_on = None


ORG_REFERENCE_COLUMNS = [
    ("campus_id", sa.String(length=128)),
    ("campus_code", sa.String(length=128)),
    ("campus_name", sa.String(length=255)),
    ("mdm_department_id", sa.String(length=128)),
    ("department_code", sa.String(length=128)),
    ("department_source", sa.String(length=64)),
    ("department_version", sa.String(length=128)),
    ("department_synced_at", sa.DateTime(timezone=True)),
    ("mdm_person_id", sa.String(length=128)),
    ("person_code", sa.String(length=128)),
    ("person_name", sa.String(length=255)),
    ("person_department_id", sa.String(length=128)),
    ("person_department_name", sa.String(length=255)),
    ("person_source", sa.String(length=64)),
    ("person_version", sa.String(length=128)),
    ("person_synced_at", sa.DateTime(timezone=True)),
    ("mdm_discipline_id", sa.String(length=128)),
    ("discipline_code", sa.String(length=128)),
    ("discipline_name", sa.String(length=255)),
    ("discipline_source", sa.String(length=64)),
    ("discipline_version", sa.String(length=128)),
    ("discipline_synced_at", sa.DateTime(timezone=True)),
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
        raise RuntimeError("e025_asset_org_person_mdm_reference 仅支持 PostgreSQL。")

    for name, coltype in ORG_REFERENCE_COLUMNS:
        if not _has_column(bind, "asset", "asset", name):
            op.add_column("asset", sa.Column(name, coltype, nullable=True), schema="asset")

    op.create_index("ix_asset_campus_id", "asset", ["campus_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_mdm_department_id", "asset", ["mdm_department_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_department_code", "asset", ["department_code"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_department_source", "asset", ["department_source"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_mdm_person_id", "asset", ["mdm_person_id"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_mdm_discipline_id", "asset", ["mdm_discipline_id"], schema="asset", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_asset_mdm_discipline_id", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_mdm_person_id", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_department_source", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_department_code", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_mdm_department_id", table_name="asset", schema="asset", if_exists=True)
    op.drop_index("ix_asset_campus_id", table_name="asset", schema="asset", if_exists=True)
    for name, _coltype in reversed(ORG_REFERENCE_COLUMNS):
        if _has_column(bind, "asset", "asset", name):
            op.drop_column("asset", name, schema="asset")
