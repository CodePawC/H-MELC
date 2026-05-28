"""PostgreSQL：supplier.qualification · 院内审核溯源字段。

对齐 docs/06_接口设计/01 §三·8（院内审核资质）；Alembic：e015 → **e016**。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e016_qualification_review_audit"
down_revision = "e015_finance_payables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e016_qualification_review_audit 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.add_column(
        "qualification",
        sa.Column("reviewed_by_user_id", pg.UUID(as_uuid=True), nullable=True),
        schema="supplier",
    )
    op.add_column(
        "qualification",
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        schema="supplier",
    )
    op.add_column(
        "qualification",
        sa.Column("review_comment", sa.Text(), nullable=True),
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_column("qualification", "review_comment", schema="supplier")
    op.drop_column("qualification", "reviewed_at", schema="supplier")
    op.drop_column("qualification", "reviewed_by_user_id", schema="supplier")
