"""PostgreSQL：mdm schema 与分类条目表（Taxonomy Phase 0）。

对齐概要：docs/01_需求文档/07_统一主数据与多分类体系设计.md
业务仍通过字符串 category_code / dimension_code 引用；后续可扩展到多维度关联。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e006_mdm_categories"
down_revision = "e005_identity_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e006_mdm_categories 仅支持 PostgreSQL（schema `mdm`）。\n"
            "请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS mdm"))

    op.create_table(
        "category_entry",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("dimension_code", sa.String(length=64), nullable=False),
        sa.Column("category_code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
            ["parent_id"],
            ["mdm.category_entry.id"],
            name="fk_mdm_category_parent",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "dimension_code",
            "category_code",
            name="uq_mdm_category_dimension_code",
        ),
        schema="mdm",
    )
    op.create_index(
        "ix_mdm_category_dimension",
        "category_entry",
        ["dimension_code"],
        schema="mdm",
        unique=False,
    )
    op.create_index(
        "ix_mdm_category_parent",
        "category_entry",
        ["parent_id"],
        schema="mdm",
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.drop_index("ix_mdm_category_parent", table_name="category_entry", schema="mdm")
    op.drop_index("ix_mdm_category_dimension", table_name="category_entry", schema="mdm")
    op.drop_table("category_entry", schema="mdm")
    op.execute(sa.text("DROP SCHEMA IF EXISTS mdm CASCADE"))
