"""PostgreSQL：workflow schema · Phase 0 审批待办占位。

对齐：docs/06_接口设计/01_API接口设计.md §八；详细引擎见 docs/02_系统架构/04_工作流引擎详细设计.md（本期仅单笔待办）。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e008_workflow_core"
down_revision = "e007_ai_knowledge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e008_workflow_core 仅支持 PostgreSQL（schema `workflow`）。\n"
            "请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS workflow"))

    op.create_table(
        "process_instance",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("process_key", sa.String(length=128), nullable=False, index=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="OPEN"),
        sa.Column("started_by_user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "payload",
            pg.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        schema="workflow",
    )

    op.create_table(
        "user_task",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "instance_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("workflow.process_instance.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("assignee_user_id", pg.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("summary", sa.String(length=512)),
        sa.Column(
            "payload",
            pg.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("outcome_comment", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        schema="workflow",
    )


def downgrade() -> None:
    op.drop_table("user_task", schema="workflow")
    op.drop_table("process_instance", schema="workflow")
    op.execute(sa.text("DROP SCHEMA IF EXISTS workflow CASCADE"))
