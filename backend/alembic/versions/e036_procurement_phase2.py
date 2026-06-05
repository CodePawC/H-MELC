"""procurement phase 2 - multi-round bidding, scoring, credit

Revision ID: e036
Revises: e035
Create Date: 2026-06-06

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e036"
down_revision = "e035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Multi-round bidding
    op.add_column("procurement_bid", sa.Column("round_number", sa.Integer(), nullable=False, server_default=sa.text("1")), schema="supplier")
    op.add_column("procurement_bid", sa.Column("is_final", sa.Boolean(), nullable=False, server_default=sa.text("false")), schema="supplier")
    op.drop_constraint("uq_procurement_bid_project_org", "procurement_bid", schema="supplier", type_="unique")
    op.create_unique_constraint("uq_procurement_bid_project_org_round", "procurement_bid", ["project_id", "organization_id", "round_number"], schema="supplier")

    # Supplier credit score
    op.add_column("organization", sa.Column("credit_score", sa.Integer(), nullable=False, server_default=sa.text("80")), schema="supplier")
    op.add_column("organization", sa.Column("credit_level", sa.String(20), nullable=False, server_default="B"), schema="supplier")
    op.add_column("organization", sa.Column("unified_social_credit_code", sa.String(64), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("contact_person", sa.String(100), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("contact_phone", sa.String(50), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("contact_email", sa.String(200), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("business_scope", sa.Text(), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("registered_capital", sa.String(100), nullable=True), schema="supplier")
    op.add_column("organization", sa.Column("established_date", sa.Date(), nullable=True), schema="supplier")

    # Price history table
    op.create_table(
        "price_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.procurement_project.id", ondelete="SET NULL"), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.organization.id", ondelete="SET NULL"), nullable=True),
        sa.Column("equipment_name", sa.String(300), nullable=False),
        sa.Column("equipment_category", sa.String(64), nullable=True),
        sa.Column("manufacturer", sa.String(200), nullable=True),
        sa.Column("model", sa.String(200), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("procurement_method", sa.String(32), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("department_name", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="supplier",
    )

    # Technical scoring template
    op.create_table(
        "scoring_template",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("criteria", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="supplier",
    )

    op.create_table(
        "project_score",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.procurement_project.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.scoring_template.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scores", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("total_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("evaluator", sa.String(128), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "organization_id", name="uq_project_score_org"),
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_table("project_score", schema="supplier")
    op.drop_table("scoring_template", schema="supplier")
    op.drop_table("price_history", schema="supplier")
    op.drop_column("organization", "established_date", schema="supplier")
    op.drop_column("organization", "registered_capital", schema="supplier")
    op.drop_column("organization", "business_scope", schema="supplier")
    op.drop_column("organization", "contact_email", schema="supplier")
    op.drop_column("organization", "contact_phone", schema="supplier")
    op.drop_column("organization", "contact_person", schema="supplier")
    op.drop_column("organization", "unified_social_credit_code", schema="supplier")
    op.drop_column("organization", "credit_level", schema="supplier")
    op.drop_column("organization", "credit_score", schema="supplier")
    op.drop_constraint("uq_procurement_bid_project_org_round", "procurement_bid", schema="supplier", type_="unique")
    op.create_unique_constraint("uq_procurement_bid_project_org", "procurement_bid", ["project_id", "organization_id"], schema="supplier")
    op.drop_column("procurement_bid", "is_final", schema="supplier")
    op.drop_column("procurement_bid", "round_number", schema="supplier")
