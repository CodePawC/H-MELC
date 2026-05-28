"""PostgreSQL：创建 asset schema 与台账/二维码表。

设计来源：docs/03_数据库设计/04_核心表结构设计.md §二·1、§二·4

重要：本 revision 仅支持 PostgreSQL。若使用 SQLite 的默认 DATABASE_URL 执行 upgrade，
会报错并拒绝标记版本，避免「版本已是 e002 但未建表」的假象。
若曾用旧版脚本在 SQLite 上误升到 e002，请先：
  alembic downgrade e001_baseline
再配置 PostgreSQL 的 DATABASE_URL 后重新 upgrade head。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e002_asset_core"
down_revision = "e001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e002_asset_core 仅支持 PostgreSQL（需创建 schema `asset`）。\n"
            "请在 backend 目录配置 .env：DATABASE_URL=postgresql+psycopg://用户:密码@主机:5432/库名\n"
            "然后重新执行：alembic upgrade head\n"
            "若本地 SQLite 已误标为 e002，请先：alembic downgrade e001_baseline"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS asset"))

    op.create_table(
        "asset",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("asset_code", sa.String(length=64), nullable=False),
        sa.Column("asset_name", sa.String(length=255), nullable=False),
        sa.Column("category_code", sa.String(length=64)),
        sa.Column("model_id", pg.UUID(as_uuid=True)),
        sa.Column("manufacturer_id", pg.UUID(as_uuid=True)),
        sa.Column("supplier_id", pg.UUID(as_uuid=True)),
        sa.Column("serial_number", sa.String(length=128)),
        sa.Column("registration_no", sa.String(length=128)),
        sa.Column("udi_di", sa.String(length=128)),
        sa.Column("udi_pi", sa.String(length=128)),
        sa.Column("department_id", pg.UUID(as_uuid=True)),
        sa.Column("location_id", pg.UUID(as_uuid=True)),
        sa.Column("purchase_date", sa.Date()),
        sa.Column("install_date", sa.Date()),
        sa.Column("warranty_end", sa.Date()),
        sa.Column("original_value", sa.Numeric(14, 2)),
        sa.Column("main_status", sa.String(length=64), nullable=False, server_default="ACTIVE"),
        sa.Column("lifecycle_phase", sa.String(length=64)),
        sa.Column("risk_level", sa.String(length=64)),
        sa.Column("regulatory_level", sa.String(length=64)),
        sa.Column("ai_health_score", sa.Numeric(5, 2)),
        sa.Column("usage_score", sa.Numeric(5, 2)),
        sa.Column("roi_score", sa.Numeric(5, 2)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("asset_code", name="uq_asset_asset_code"),
        schema="asset",
    )

    op.create_table(
        "asset_qrcode",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("asset_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("qr_token", sa.String(length=255), nullable=False),
        sa.Column("qr_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expired_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.asset.id"],
            name="fk_asset_qrcode_asset_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("qr_token", name="uq_asset_qrcode_qr_token"),
        schema="asset",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_table("asset_qrcode", schema="asset")
    op.drop_table("asset", schema="asset")
    op.execute(sa.text("DROP SCHEMA IF EXISTS asset CASCADE"))
