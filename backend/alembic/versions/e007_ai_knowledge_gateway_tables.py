"""PostgreSQL：ai schema（任务/结果占位网关）与 knowledge schema（文档元数据）。

对齐：docs/06_接口设计/01_API接口设计.md §六、§七；持久化占位直至 ai-service/RAG 落地。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e007_ai_knowledge"
down_revision = "e006_mdm_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e007_ai_knowledge 仅支持 PostgreSQL（schema `ai`、`knowledge`）。\n"
            "请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS ai"))
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS knowledge"))

    op.create_table(
        "ai_task",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_type", sa.String(length=64), nullable=False, index=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column(
            "input_payload",
            pg.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_by_user_id", pg.UUID(as_uuid=True)),
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
        schema="ai",
    )

    op.create_table(
        "ai_result",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("ai.ai_task.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "output_payload",
            pg.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("review_comment", sa.Text()),
        sa.Column("reviewed_by_user_id", pg.UUID(as_uuid=True)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="ai",
    )
    op.create_index("ix_ai_result_task_id", "ai_result", ["task_id"], unique=True, schema="ai")

    op.create_table(
        "kb_document",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False, server_default="UPLOAD"),
        sa.Column("object_key", sa.String(length=768)),
        sa.Column("mime_type", sa.String(length=128)),
        sa.Column("file_size", sa.BigInteger()),
        sa.Column("created_by_user_id", pg.UUID(as_uuid=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="knowledge",
    )
    op.create_index("ix_kb_document_created_at", "kb_document", ["created_at"], schema="knowledge")


def downgrade() -> None:
    op.drop_index("ix_kb_document_created_at", table_name="kb_document", schema="knowledge")
    op.drop_table("kb_document", schema="knowledge")
    op.drop_index("ix_ai_result_task_id", table_name="ai_result", schema="ai")
    op.drop_table("ai_result", schema="ai")
    op.drop_table("ai_task", schema="ai")
    op.execute(sa.text("DROP SCHEMA IF EXISTS knowledge CASCADE"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS ai CASCADE"))
