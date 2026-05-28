"""PostgreSQL：`supplier` schema · 门户账号与资质（Phase 0）。

对齐：docs/06_接口设计/01_API接口设计.md §四；竞价/报价与 §三联动待后续迭代。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e009_supplier_portal"
down_revision = "e008_workflow_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e009_supplier_portal 仅支持 PostgreSQL（schema `supplier`）。\n"
            "请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS supplier"))

    op.create_table(
        "organization",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("legal_name", sa.String(length=256), nullable=False),
        sa.Column("short_name", sa.String(length=128)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="supplier",
    )

    op.create_table(
        "portal_account",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("username", sa.String(length=64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=128)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="supplier",
    )

    op.create_table(
        "qualification",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("credential_type", sa.String(length=64)),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("object_key", sa.String(length=768)),
        sa.Column("mime_type", sa.String(length=128)),
        sa.Column("file_size", sa.BigInteger()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_table("qualification", schema="supplier")
    op.drop_table("portal_account", schema="supplier")
    op.drop_table("organization", schema="supplier")
    op.execute(sa.text("DROP SCHEMA IF EXISTS supplier CASCADE"))
