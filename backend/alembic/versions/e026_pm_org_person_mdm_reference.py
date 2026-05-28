"""pm organization and person mdm reference fields

Revision ID: e026_pm_org_person_mdm_ref
Revises: e025_asset_org_person_mdm_ref
Create Date: 2026-05-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e026_pm_org_person_mdm_ref"
down_revision = "e025_asset_org_person_mdm_ref"
branch_labels = None
depends_on = None


PLAN_COLUMNS = [
    ("mdm_department_id", sa.String(length=128)),
    ("department_code", sa.String(length=128)),
    ("department_name", sa.String(length=255)),
    ("department_source", sa.String(length=64)),
    ("department_version", sa.String(length=128)),
    ("department_synced_at", sa.DateTime(timezone=True)),
]

PERSON_COLUMNS = [
    ("mdm_person_id", sa.String(length=128)),
    ("person_code", sa.String(length=128)),
    ("person_name", sa.String(length=255)),
    ("person_source", sa.String(length=64)),
    ("person_version", sa.String(length=128)),
    ("person_synced_at", sa.DateTime(timezone=True)),
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


def _add_columns(bind: sa.engine.Connection, table: str, columns: list[tuple[str, sa.types.TypeEngine]]) -> None:
    for name, coltype in columns:
        if not _has_column(bind, "pm", table, name):
            op.add_column(table, sa.Column(name, coltype, nullable=True), schema="pm")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e026_pm_org_person_mdm_reference 仅支持 PostgreSQL。")

    _add_columns(bind, "pm_plan", PLAN_COLUMNS)
    _add_columns(bind, "pm_task", PERSON_COLUMNS)
    _add_columns(bind, "pm_inspection_task", [*PLAN_COLUMNS, *PERSON_COLUMNS])

    op.create_index("ix_pm_plan_mdm_department_id", "pm_plan", ["mdm_department_id"], schema="pm", if_not_exists=True)
    op.create_index("ix_pm_task_mdm_person_id", "pm_task", ["mdm_person_id"], schema="pm", if_not_exists=True)
    op.create_index("ix_pm_inspection_task_mdm_department_id", "pm_inspection_task", ["mdm_department_id"], schema="pm", if_not_exists=True)
    op.create_index("ix_pm_inspection_task_mdm_person_id", "pm_inspection_task", ["mdm_person_id"], schema="pm", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_pm_inspection_task_mdm_person_id", table_name="pm_inspection_task", schema="pm", if_exists=True)
    op.drop_index("ix_pm_inspection_task_mdm_department_id", table_name="pm_inspection_task", schema="pm", if_exists=True)
    op.drop_index("ix_pm_task_mdm_person_id", table_name="pm_task", schema="pm", if_exists=True)
    op.drop_index("ix_pm_plan_mdm_department_id", table_name="pm_plan", schema="pm", if_exists=True)
    for table, columns in [
        ("pm_inspection_task", [*PLAN_COLUMNS, *PERSON_COLUMNS]),
        ("pm_task", PERSON_COLUMNS),
        ("pm_plan", PLAN_COLUMNS),
    ]:
        for name, _coltype in reversed(columns):
            if _has_column(bind, "pm", table, name):
                op.drop_column(table, name, schema="pm")
