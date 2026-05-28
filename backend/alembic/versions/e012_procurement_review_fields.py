"""PostgreSQL：supplier.procurement_project 审核字段（§三·6 落库）。

Alembic：`e011_procurement_bids` → **e012**.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e012_procurement_review_fields"
down_revision = "e011_procurement_bids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e012_procurement_review 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.add_column(
        "procurement_project",
        sa.Column("review_remark", sa.Text(), nullable=True),
        schema="supplier",
    )
    op.add_column(
        "procurement_project",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        schema="supplier",
    )
    op.add_column(
        "procurement_project",
        sa.Column("reviewer_user_id", pg.UUID(as_uuid=True), nullable=True),
        schema="supplier",
    )
    op.create_index(
        "ix_procurement_project_reviewer_user_id",
        "procurement_project",
        ["reviewer_user_id"],
        unique=False,
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_procurement_project_reviewer_user_id",
        table_name="procurement_project",
        schema="supplier",
    )
    op.drop_column("procurement_project", "reviewer_user_id", schema="supplier")
    op.drop_column("procurement_project", "reviewed_at", schema="supplier")
    op.drop_column("procurement_project", "review_remark", schema="supplier")
