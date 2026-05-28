"""Asset H-UMDG business partner references.

Revision ID: e027_asset_partner_mdm_ref
Revises: e026_pm_org_person_mdm_ref
Create Date: 2026-05-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "e027_asset_partner_mdm_ref"
down_revision = "e026_pm_org_person_mdm_ref"
branch_labels = None
depends_on = None


def _columns(schema: str, table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table, schema=schema)}


def _add(table: str, column: sa.Column, *, schema: str = "asset") -> None:
    if column.name not in _columns(schema, table):
        op.add_column(table, column, schema=schema)


def _idx(name: str, table: str, columns: list[str], *, schema: str = "asset") -> None:
    inspector = inspect(op.get_bind())
    existing = {idx["name"] for idx in inspector.get_indexes(table, schema=schema)}
    if name not in existing:
        op.create_index(name, table, columns, schema=schema)


def upgrade() -> None:
    for column in [
        sa.Column("manufacturer_org_id", sa.String(length=128), nullable=True),
        sa.Column("supplier_org_id", sa.String(length=128), nullable=True),
        sa.Column("brand_owner_org_id", sa.String(length=128), nullable=True),
        sa.Column("brand_owner_org_code", sa.String(length=128), nullable=True),
        sa.Column("brand_owner_name", sa.String(length=255), nullable=True),
        sa.Column("registration_holder_org_id", sa.String(length=128), nullable=True),
        sa.Column("registration_holder_org_code", sa.String(length=128), nullable=True),
        sa.Column("registration_holder_name", sa.String(length=255), nullable=True),
        sa.Column("maintainer_org_id", sa.String(length=128), nullable=True),
        sa.Column("maintainer_org_code", sa.String(length=128), nullable=True),
        sa.Column("maintainer_name", sa.String(length=255), nullable=True),
        sa.Column("installer_org_id", sa.String(length=128), nullable=True),
        sa.Column("installer_org_code", sa.String(length=128), nullable=True),
        sa.Column("installer_name", sa.String(length=255), nullable=True),
        sa.Column("org_source", sa.String(length=64), nullable=True),
        sa.Column("org_version", sa.String(length=128), nullable=True),
        sa.Column("org_synced_at", sa.DateTime(timezone=True), nullable=True),
    ]:
        _add("asset", column)
    for name, column in [
        ("ix_asset_manufacturer_org_id", "manufacturer_org_id"),
        ("ix_asset_supplier_org_id", "supplier_org_id"),
        ("ix_asset_brand_owner_org_id", "brand_owner_org_id"),
        ("ix_asset_registration_holder_org_id", "registration_holder_org_id"),
        ("ix_asset_maintainer_org_id", "maintainer_org_id"),
        ("ix_asset_installer_org_id", "installer_org_id"),
        ("ix_asset_org_source", "org_source"),
    ]:
        _idx(name, "asset", [column])


def downgrade() -> None:
    for name in [
        "ix_asset_org_source",
        "ix_asset_installer_org_id",
        "ix_asset_maintainer_org_id",
        "ix_asset_registration_holder_org_id",
        "ix_asset_brand_owner_org_id",
        "ix_asset_supplier_org_id",
        "ix_asset_manufacturer_org_id",
    ]:
        op.drop_index(name, table_name="asset", schema="asset", if_exists=True)
    for column in [
        "org_synced_at",
        "org_version",
        "org_source",
        "installer_name",
        "installer_org_code",
        "installer_org_id",
        "maintainer_name",
        "maintainer_org_code",
        "maintainer_org_id",
        "registration_holder_name",
        "registration_holder_org_code",
        "registration_holder_org_id",
        "brand_owner_name",
        "brand_owner_org_code",
        "brand_owner_org_id",
        "supplier_org_id",
        "manufacturer_org_id",
    ]:
        op.drop_column("asset", column, schema="asset")
