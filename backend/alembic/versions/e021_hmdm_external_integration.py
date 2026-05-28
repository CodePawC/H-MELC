"""H-UMDG external master-data integration

Revision ID: e021_hmdm_external_integration
Revises: e020_hmdm_integration
Create Date: 2026-05-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = "e021_hmdm_external_integration"
down_revision = "e020_hmdm_integration"
branch_labels = None
depends_on = None


ASSET_HMDM_COLUMNS = [
    ("brand", sa.String(length=128)),
    ("model", sa.String(length=128)),
    ("department_name", sa.String(length=255)),
    ("location", sa.String(length=255)),
    ("warranty_status", sa.String(length=64)),
    ("hmdm_equipment_category_code", sa.String(length=128)),
    ("hmdm_equipment_category_name", sa.String(length=255)),
    ("hmdm_equipment_name_code", sa.String(length=128)),
    ("hmdm_standard_name", sa.String(length=255)),
    ("hmdm_regulatory_major_category", sa.String(length=128)),
    ("hmdm_primary_product_category", sa.String(length=128)),
    ("hmdm_secondary_product_category", sa.String(length=128)),
    ("hmdm_management_class", sa.String(length=64)),
    ("manufacturer_org_code", sa.String(length=128)),
    ("manufacturer_name", sa.String(length=255)),
    ("supplier_org_code", sa.String(length=128)),
    ("supplier_name", sa.String(length=255)),
    ("after_sales_org_code", sa.String(length=128)),
    ("after_sales_name", sa.String(length=255)),
    ("service_provider_org_code", sa.String(length=128)),
    ("service_provider_name", sa.String(length=255)),
]


def _has_column(bind: sa.engine.Connection, schema: str, table: str, column: str) -> bool:
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table
              AND column_name = :column
            """
        ),
        {"schema": schema, "table": table, "column": column},
    ).first()
    return result is not None


def _has_table(bind: sa.engine.Connection, schema: str, table: str) -> bool:
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_name = :table
            """
        ),
        {"schema": schema, "table": table},
    ).first()
    return result is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("e021_hmdm_external_integration 仅支持 PostgreSQL。")

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS integration"))

    for name, coltype in ASSET_HMDM_COLUMNS:
        if not _has_column(bind, "asset", "asset", name):
            op.add_column("asset", sa.Column(name, coltype, nullable=True), schema="asset")
    op.create_index("ix_asset_hmdm_equipment_name_code", "asset", ["hmdm_equipment_name_code"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_manufacturer_org_code", "asset", ["manufacturer_org_code"], schema="asset", if_not_exists=True)
    op.create_index("ix_asset_supplier_org_code", "asset", ["supplier_org_code"], schema="asset", if_not_exists=True)

    if not _has_table(bind, "integration", "hmdm_dictionary_cache"):
        op.create_table(
            "hmdm_dictionary_cache",
            sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("source_type", sa.String(length=64), nullable=False),
            sa.Column("source_code", sa.String(length=128), nullable=False),
            sa.Column("source_name", sa.String(length=255), nullable=False),
            sa.Column("payload_json", pg.JSONB(), nullable=False),
            sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("expire_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("source_type", "source_code", name="uq_hmdm_dictionary_cache_source"),
            schema="integration",
        )
    op.create_index("ix_hmdm_dictionary_cache_source_type", "hmdm_dictionary_cache", ["source_type"], schema="integration", if_not_exists=True)
    op.create_index("ix_hmdm_dictionary_cache_source_code", "hmdm_dictionary_cache", ["source_code"], schema="integration", if_not_exists=True)
    op.create_index("ix_hmdm_dictionary_cache_expire_at", "hmdm_dictionary_cache", ["expire_at"], schema="integration", if_not_exists=True)

    if not _has_table(bind, "integration", "equipment_standard_name_request"):
        op.create_table(
            "equipment_standard_name_request",
            sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("proposed_name", sa.String(length=255), nullable=False),
            sa.Column("alias_names", pg.JSONB(), nullable=True),
            sa.Column("suggested_category", sa.String(length=255), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("submitted_by", sa.String(length=128), nullable=False),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("id"),
            schema="integration",
        )
    op.create_index("ix_equipment_standard_name_request_status", "equipment_standard_name_request", ["status"], schema="integration", if_not_exists=True)

    if not _has_table(bind, "integration", "manufacturer_vendor_request"):
        op.create_table(
            "manufacturer_vendor_request",
            sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
            sa.Column("proposed_standard_name", sa.String(length=255), nullable=False),
            sa.Column("english_name", sa.String(length=255), nullable=True),
            sa.Column("short_name", sa.String(length=128), nullable=True),
            sa.Column("alias_names", pg.JSONB(), nullable=True),
            sa.Column("unified_social_credit_code", sa.String(length=64), nullable=True),
            sa.Column("suggested_role_type", sa.String(length=64), nullable=True),
            sa.Column("business_domain", sa.String(length=64), nullable=True),
            sa.Column("contact_info", pg.JSONB(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("submitted_by", sa.String(length=128), nullable=False),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.PrimaryKeyConstraint("id"),
            schema="integration",
        )
    op.create_index("ix_manufacturer_vendor_request_status", "manufacturer_vendor_request", ["status"], schema="integration", if_not_exists=True)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_manufacturer_vendor_request_status", table_name="manufacturer_vendor_request", schema="integration")
    op.drop_table("manufacturer_vendor_request", schema="integration")
    op.drop_index("ix_equipment_standard_name_request_status", table_name="equipment_standard_name_request", schema="integration")
    op.drop_table("equipment_standard_name_request", schema="integration")
    op.drop_index("ix_hmdm_dictionary_cache_expire_at", table_name="hmdm_dictionary_cache", schema="integration")
    op.drop_index("ix_hmdm_dictionary_cache_source_code", table_name="hmdm_dictionary_cache", schema="integration")
    op.drop_index("ix_hmdm_dictionary_cache_source_type", table_name="hmdm_dictionary_cache", schema="integration")
    op.drop_table("hmdm_dictionary_cache", schema="integration")

    op.drop_index("ix_asset_supplier_org_code", table_name="asset", schema="asset")
    op.drop_index("ix_asset_manufacturer_org_code", table_name="asset", schema="asset")
    op.drop_index("ix_asset_hmdm_equipment_name_code", table_name="asset", schema="asset")
    for name, _ in reversed(ASSET_HMDM_COLUMNS):
        op.drop_column("asset", name, schema="asset")
