"""PostgreSQL：创建 audit schema 与 audit_log 表。

设计来源：docs/03_数据库设计/04_核心表结构设计.md · 八
接口：docs/06_接口设计/01_API接口设计.md §九
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e004_audit_core"
down_revision = "e003_repair_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e004_audit_core 仅支持 PostgreSQL（需创建 schema `audit`）。\n"
            "请配置 DATABASE_URL 为 PostgreSQL 后执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS audit"))

    op.create_table(
        "audit_log",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True)),
        sa.Column("username", sa.String(length=128)),
        sa.Column("role_code", sa.String(length=64)),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("object_type", sa.String(length=64)),
        sa.Column("object_id", pg.UUID(as_uuid=True)),
        sa.Column("before_data", pg.JSONB()),
        sa.Column("after_data", pg.JSONB()),
        sa.Column("ip_address", sa.String(length=64)),
        sa.Column("user_agent", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="audit",
    )

    op.create_index(
        "ix_audit_audit_log_created_at",
        "audit_log",
        ["created_at"],
        schema="audit",
        unique=False,
    )
    op.create_index(
        "ix_audit_audit_log_action",
        "audit_log",
        ["action"],
        schema="audit",
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.drop_index("ix_audit_audit_log_action", table_name="audit_log", schema="audit")
    op.drop_index("ix_audit_audit_log_created_at", table_name="audit_log", schema="audit")
    op.drop_table("audit_log", schema="audit")
    op.execute(sa.text("DROP SCHEMA IF EXISTS audit CASCADE"))
