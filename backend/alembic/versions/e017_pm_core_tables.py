"""PostgreSQL：创建 pm schema — 保养计划、保养任务、巡检任务。

对齐 docs/06_接口设计/01_API接口设计.md · 十（PM）；命名以实现为准。
down_revision: e016_qualification_review_audit
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e017_pm_core"
down_revision = "e016_qualification_review_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e017_pm_core 仅支持 PostgreSQL（需创建 schema `pm`）。"
            " 请配置 DATABASE_URL 为 PostgreSQL 后执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS pm"))

    op.create_table(
        "pm_plan",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("frequency", sa.String(length=32), nullable=False),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("owner_department_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("plan_status", sa.String(length=32), nullable=False, server_default="DRAFT"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.asset.id"],
            name="fk_pm_plan_asset_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("code", name="uq_pm_plan_code"),
        schema="pm",
    )
    op.create_index("ix_pm_plan_asset_id", "pm_plan", ["asset_id"], unique=False, schema="pm")
    op.create_index("ix_pm_plan_next_due_date", "pm_plan", ["next_due_date"], unique=False, schema="pm")

    op.create_table(
        "pm_task",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("plan_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("task_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("assigned_engineer_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["pm.pm_plan.id"],
            name="fk_pm_task_plan_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.asset.id"],
            name="fk_pm_task_asset_id",
            ondelete="RESTRICT",
        ),
        schema="pm",
    )
    op.create_index("ix_pm_task_plan_id", "pm_task", ["plan_id"], unique=False, schema="pm")
    op.create_index("ix_pm_task_asset_id", "pm_task", ["asset_id"], unique=False, schema="pm")
    op.create_index("ix_pm_task_due_date", "pm_task", ["due_date"], unique=False, schema="pm")

    op.create_table(
        "pm_inspection_task",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("inspection_type", sa.String(length=64), nullable=False, server_default="ROUTINE"),
        sa.Column("department_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("task_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("checklist_result", pg.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("inspector_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.asset.id"],
            name="fk_pm_inspection_task_asset_id",
            ondelete="SET NULL",
        ),
        schema="pm",
    )
    op.create_index(
        "ix_pm_inspection_task_due_date",
        "pm_inspection_task",
        ["due_date"],
        unique=False,
        schema="pm",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e017_pm_core downgrade 仅支持 PostgreSQL。")
    op.drop_table("pm_inspection_task", schema="pm")
    op.drop_table("pm_task", schema="pm")
    op.drop_table("pm_plan", schema="pm")
    op.execute(sa.text("DROP SCHEMA IF EXISTS pm CASCADE"))
