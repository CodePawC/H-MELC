"""PostgreSQL：supplier.procurement_bid · 门户报价。



对齐 docs/06_接口设计/01 §三·5；Alembic 链：`e009` → `e010` → **e011**。

"""



from __future__ import annotations



import sqlalchemy as sa

from alembic import op

from sqlalchemy.dialects import postgresql as pg



revision = "e011_procurement_bids"

down_revision = "e010_procurement_projects"

branch_labels = None

depends_on = None





def upgrade() -> None:

    bind = op.get_bind()

    if bind.dialect.name != "postgresql":

        raise RuntimeError(

            "e011_procurement_bids 仅支持 PostgreSQL。\n请在 PostgreSQL 上执行 alembic upgrade head。"

        )



    op.create_table(

        "procurement_bid",

        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),

        sa.Column(

            "project_id",

            pg.UUID(as_uuid=True),

            sa.ForeignKey("supplier.procurement_project.id", ondelete="CASCADE"),

            nullable=False,

            index=True,

        ),

        sa.Column(

            "organization_id",

            pg.UUID(as_uuid=True),

            sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"),

            nullable=False,

            index=True,

        ),

        sa.Column(

            "portal_account_id",

            pg.UUID(as_uuid=True),

            sa.ForeignKey("supplier.portal_account.id", ondelete="SET NULL"),

            nullable=True,

        ),

        sa.Column(

            "quoted_amount",

            sa.Numeric(precision=14, scale=2),

            nullable=False,

        ),

        sa.Column(

            "currency",

            sa.String(length=8),

            nullable=False,

            server_default="CNY",

        ),

        sa.Column("remark", sa.Text()),

        sa.Column(

            "created_at",

            sa.DateTime(timezone=True),

            nullable=False,

            server_default=sa.text("now()"),

        ),

        sa.UniqueConstraint("project_id", "organization_id", name="uq_procurement_bid_project_org"),

        schema="supplier",

    )





def downgrade() -> None:

    op.drop_table("procurement_bid", schema="supplier")


