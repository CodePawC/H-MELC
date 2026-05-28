"""PostgreSQL：supplier.procurement_project.winning_bid_id · 收官时可选指定中选报价。

对齐 docs/06_接口设计/01 §三·6；Alembic：`e012_procurement_review_fields` → **e013**。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e013_procurement_winning_bid"
down_revision = "e012_procurement_review_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e013_procurement_winning_bid 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.add_column(
        "procurement_project",
        sa.Column(
            "winning_bid_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("supplier.procurement_bid.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_column("procurement_project", "winning_bid_id", schema="supplier")
