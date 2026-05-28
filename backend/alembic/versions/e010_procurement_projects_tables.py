"""PostgreSQL：`supplier.procurement_project` · 院内发布外修竞价项目。

对齐：docs/06_接口设计/01_API接口设计.md §三·3、`GET /supplier-portal/projects`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e010_procurement_projects"
down_revision = "e009_supplier_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e010_procurement_projects 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS supplier"))

    op.create_table(
        "procurement_project",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column(
            "repair_order_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("repair.repair_order.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="OPEN"),
        sa.Column("publisher_user_id", pg.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("bid_deadline", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="supplier",
    )
    op.create_index(
        "ix_procurement_project_status_created",
        "procurement_project",
        ["status", "created_at"],
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_procurement_project_status_created",
        table_name="procurement_project",
        schema="supplier",
    )
    op.drop_table("procurement_project", schema="supplier")
