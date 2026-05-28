"""PostgreSQL：创建 repair schema 与报修维修核心表。

设计来源：docs/03_数据库设计/04_核心表结构设计.md §三

仅支持 PostgreSQL；与 e002_asset_core 同理，SQLite 上会拒绝升级。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e003_repair_core"
down_revision = "e002_asset_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e003_repair_core 仅支持 PostgreSQL（需创建 schema `repair`）。\n"
            "请配置 DATABASE_URL 为 PostgreSQL 后执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS repair"))

    op.create_table(
        "repair_order",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("order_code", sa.String(length=64), nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("report_department_id", pg.UUID(as_uuid=True)),
        sa.Column("reporter_id", pg.UUID(as_uuid=True)),
        sa.Column("reporter_name", sa.String(length=128)),
        sa.Column("reporter_phone", sa.String(length=64)),
        sa.Column("fault_description", sa.Text()),
        sa.Column("fault_type", sa.String(length=64), nullable=True),
        sa.Column("fault_level", sa.String(length=32)),
        sa.Column("priority", sa.String(length=32)),
        sa.Column("order_status", sa.String(length=64), nullable=False, server_default="PENDING_DISPATCH"),
        sa.Column("assigned_engineer_id", pg.UUID(as_uuid=True)),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("is_outsourced", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_return_factory", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_chargeable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("estimated_cost", sa.Numeric(14, 2)),
        sa.Column("actual_cost", sa.Numeric(14, 2)),
        sa.Column("ai_risk_level", sa.String(length=64)),
        sa.Column(
            "ai_incident_suggestion",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
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
            ["asset_id"],
            ["asset.asset.id"],
            name="fk_repair_order_asset_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("order_code", name="uq_repair_order_code"),
        schema="repair",
    )

    op.create_table(
        "repair_attachment",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("file_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("file_type", sa.String(length=64)),
        sa.Column("description", sa.Text()),
        sa.Column("uploaded_by", pg.UUID(as_uuid=True)),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["repair_order_id"],
            ["repair.repair_order.id"],
            name="fk_repair_attachment_order_id",
            ondelete="CASCADE",
        ),
        schema="repair",
    )

    op.create_table(
        "repair_process_record",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("record_type", sa.String(length=64)),
        sa.Column("content", sa.Text()),
        sa.Column("engineer_id", pg.UUID(as_uuid=True)),
        sa.Column("engineer_name", sa.String(length=128)),
        sa.Column("ai_assisted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ai_result_id", pg.UUID(as_uuid=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("metadata", pg.JSONB()),
        sa.ForeignKeyConstraint(
            ["repair_order_id"],
            ["repair.repair_order.id"],
            name="fk_repair_process_order_id",
            ondelete="CASCADE",
        ),
        schema="repair",
    )

    op.create_table(
        "repair_report",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("repair_order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("fault_cause", sa.Text()),
        sa.Column("repair_method", sa.Text()),
        sa.Column("replaced_parts", sa.Text()),
        sa.Column("test_result", sa.Text()),
        sa.Column("conclusion", sa.Text()),
        sa.Column("ai_generated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ai_result_id", pg.UUID(as_uuid=True)),
        sa.Column("department_confirm_status", sa.String(length=64)),
        sa.Column("department_confirm_by", pg.UUID(as_uuid=True)),
        sa.Column("department_confirm_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["repair_order_id"],
            ["repair.repair_order.id"],
            name="fk_repair_report_order_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "repair_order_id",
            name="uq_repair_report_single_per_order",
        ),
        schema="repair",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_table("repair_report", schema="repair")
    op.drop_table("repair_process_record", schema="repair")
    op.drop_table("repair_attachment", schema="repair")
    op.drop_table("repair_order", schema="repair")
    op.execute(sa.text("DROP SCHEMA IF EXISTS repair CASCADE"))
