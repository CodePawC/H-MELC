"""PostgreSQL：finance.payable / finance.payment / finance.payment_allocation

对齐 docs/06_接口设计/01 §五·5～8；Alembic：e014 → **e015**。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e015_finance_payables"
down_revision = "e014_finance_invoice"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e015_finance_payables 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.create_table(
        "payable",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.organization.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(length=512), nullable=False, server_default=sa.text("''")),
        sa.Column("amount_due", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="OPEN"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="finance",
    )
    op.create_index(
        "ix_finance_payable_org_due",
        "payable",
        ["organization_id", "due_date"],
        schema="finance",
    )

    op.create_table(
        "payment",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "organization_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.organization.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("recorded_by_user_id", pg.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("payment_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="finance",
    )
    op.create_index(
        "ix_finance_payment_org_date",
        "payment",
        ["organization_id", "payment_date"],
        schema="finance",
    )

    op.create_table(
        "payment_allocation",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "payment_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("finance.payment.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "invoice_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("finance.invoice.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "payable_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("finance.payable.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("allocated_amount", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint(
            "(invoice_id IS NOT NULL AND payable_id IS NULL) OR (invoice_id IS NULL AND payable_id IS NOT NULL)",
            name="ck_finance_payment_allocation_target",
        ),
        schema="finance",
    )


def downgrade() -> None:
    op.drop_table("payment_allocation", schema="finance")
    op.drop_index("ix_finance_payment_org_date", table_name="payment", schema="finance")
    op.drop_table("payment", schema="finance")
    op.drop_index("ix_finance_payable_org_due", table_name="payable", schema="finance")
    op.drop_table("payable", schema="finance")
