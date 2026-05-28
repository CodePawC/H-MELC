"""PostgreSQL：创建 metrology schema — 计量设备、计划、证书。

对齐 docs/06_接口设计/01_API接口设计.md · 十一（计量与合规）。
down_revision: e017_pm_core
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e018_metrology_core"
down_revision = "e017_pm_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e018_metrology_core 仅支持 PostgreSQL（需创建 schema `metrology`）。"
            " 请配置 DATABASE_URL 为 PostgreSQL 后执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS metrology"))

    op.create_table(
        "metrology_device",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("regulatory_class", sa.String(length=64), nullable=False, server_default="GENERAL"),
        sa.Column("calibration_status", sa.String(length=32), nullable=False, server_default="NORMAL"),
        sa.Column("meter_type", sa.String(length=64), nullable=True),
        sa.Column("cycle_months", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("last_calibrated_at", sa.Date(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("issuing_body", sa.String(length=255), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset.id"], name="fk_metrology_device_asset_id", ondelete="CASCADE"),
        sa.UniqueConstraint("asset_id", name="uq_metrology_device_asset_id"),
        schema="metrology",
    )
    op.create_index("ix_metrology_device_status", "metrology_device", ["calibration_status"], schema="metrology")
    op.create_index("ix_metrology_device_due", "metrology_device", ["next_due_date"], schema="metrology")
    op.create_index("ix_metrology_device_reg_class", "metrology_device", ["regulatory_class"], schema="metrology")

    op.create_table(
        "calibration_plan",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("plan_status", sa.String(length=32), nullable=False, server_default="PLANNED"),
        sa.Column("assigned_org", sa.String(length=255), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset.id"], name="fk_calibration_plan_asset_id", ondelete="CASCADE"),
        schema="metrology",
    )
    op.create_index("ix_calibration_plan_asset_id", "calibration_plan", ["asset_id"], schema="metrology")
    op.create_index("ix_calibration_plan_date", "calibration_plan", ["planned_date"], schema="metrology")
    op.create_index("ix_calibration_plan_status", "calibration_plan", ["plan_status"], schema="metrology")

    op.create_table(
        "metrology_certificate",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("certificate_no", sa.String(length=128), nullable=False),
        sa.Column("issued_at", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("issuing_body", sa.String(length=255), nullable=True),
        sa.Column("conclusion", sa.String(length=64), nullable=False, server_default="PASS"),
        sa.Column("object_key", sa.String(length=1024), nullable=True),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset.id"], name="fk_metrology_certificate_asset_id", ondelete="CASCADE"),
        sa.UniqueConstraint("certificate_no", name="uq_metrology_certificate_no"),
        schema="metrology",
    )
    op.create_index("ix_metrology_certificate_asset_id", "metrology_certificate", ["asset_id"], schema="metrology")
    op.create_index("ix_metrology_certificate_valid_to", "metrology_certificate", ["valid_to"], schema="metrology")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e018_metrology_core downgrade 仅支持 PostgreSQL。")
    op.drop_table("metrology_certificate", schema="metrology")
    op.drop_table("calibration_plan", schema="metrology")
    op.drop_table("metrology_device", schema="metrology")
    op.execute(sa.text("DROP SCHEMA IF EXISTS metrology CASCADE"))
