"""PostgreSQL：finance.invoice · 院内发票上传与 OCR 占位链路。

对齐 docs/06_接口设计/01 §五·1~4；Alembic：`e013_procurement_winning_bid` → **e014**。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e014_finance_invoice"
down_revision = "e013_procurement_winning_bid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e014_finance_invoice 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS finance"))

    op.create_table(
        "invoice",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.organization.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("uploaded_by_user_id", pg.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("object_key", sa.String(length=768), nullable=False),
        sa.Column("mime_type", sa.String(length=128)),
        sa.Column("file_size", sa.BigInteger()),
        sa.Column(
            "ai_task_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("ai.ai_task.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "ai_result_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("ai.ai_result.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="finance",
    )
    op.create_index(
        "ix_finance_invoice_org_created",
        "invoice",
        ["organization_id", "created_at"],
        schema="finance",
    )


def downgrade() -> None:
    op.drop_index("ix_finance_invoice_org_created", table_name="invoice", schema="finance")
    op.drop_table("invoice", schema="finance")
    op.execute(sa.text("DROP SCHEMA IF EXISTS finance CASCADE"))
