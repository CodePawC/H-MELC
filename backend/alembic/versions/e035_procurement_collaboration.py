"""procurement collaboration — extended project fields, inquiries, clarifications, notifications

Revision ID: e035
Revises: e034
Create Date: 2026-06-06

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e035"
down_revision = "e034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend procurement_project
    op.add_column("procurement_project", sa.Column("project_code", sa.String(64), nullable=True, index=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("category", sa.String(64), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("procurement_method", sa.String(32), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("budget_amount", sa.Numeric(14, 2), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("content", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("department_name", sa.String(200), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("tech_params", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("config_list", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("service_requirements", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("delivery_requirements", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("acceptance_requirements", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("qualification_requirements", sa.Text(), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("registration_start", sa.DateTime(timezone=True), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("registration_end", sa.DateTime(timezone=True), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True), schema="supplier")
    op.add_column("procurement_project", sa.Column("draft", sa.Boolean(), nullable=False, server_default=sa.text("true")), schema="supplier")
    op.add_column("procurement_project", sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")), schema="supplier")
    op.add_column("procurement_project", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")), schema="supplier")

    # Update status to allow more states: DRAFT, PENDING_REVIEW, PUBLISHED, REGISTERING, QUALIFYING,
    # INQUIRING, BIDDING, EVALUATING, AWARDED, TERMINATED, ARCHIVED
    op.execute("ALTER TABLE supplier.procurement_project ALTER COLUMN status TYPE VARCHAR(32)")
    op.execute("ALTER TABLE supplier.procurement_project ALTER COLUMN status SET DEFAULT 'DRAFT'")

    # procurement_enrollment — supplier registration for projects
    op.create_table(
        "procurement_enrollment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.procurement_project.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portal_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.portal_account.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("contact_name", sa.String(100), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("contact_email", sa.String(200), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(128), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "organization_id", name="uq_enrollment_project_org"),
        schema="supplier",
    )

    # procurement_clarification — Q&A for projects
    op.create_table(
        "procurement_clarification",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.procurement_project.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_by", sa.String(128), nullable=True),
        sa.Column("question_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("answer_by", sa.String(128), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="supplier",
    )

    # procurement_bid — add attachment fields
    op.add_column("procurement_bid", sa.Column("attachment_name", sa.String(255), nullable=True), schema="supplier")
    op.add_column("procurement_bid", sa.Column("attachment_key", sa.String(768), nullable=True), schema="supplier")
    op.add_column("procurement_bid", sa.Column("bid_status", sa.String(32), nullable=False, server_default="SUBMITTED"), schema="supplier")

    # notification_center
    op.create_table(
        "notification_message",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.organization.id", ondelete="CASCADE"), nullable=True),
        sa.Column("portal_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier.portal_account.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(32), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False, server_default="SITE"),
        sa.Column("send_status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fail_reason", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="supplier",
    )


def downgrade() -> None:
    op.drop_table("notification_message", schema="supplier")
    op.drop_table("procurement_clarification", schema="supplier")
    op.drop_table("procurement_enrollment", schema="supplier")
    op.drop_column("procurement_bid", "bid_status", schema="supplier")
    op.drop_column("procurement_bid", "attachment_key", schema="supplier")
    op.drop_column("procurement_bid", "attachment_name", schema="supplier")
    op.drop_column("procurement_project", "is_public", schema="supplier")
    op.drop_column("procurement_project", "archived", schema="supplier")
    op.drop_column("procurement_project", "draft", schema="supplier")
    op.drop_column("procurement_project", "publish_at", schema="supplier")
    op.drop_column("procurement_project", "registration_end", schema="supplier")
    op.drop_column("procurement_project", "registration_start", schema="supplier")
    op.drop_column("procurement_project", "qualification_requirements", schema="supplier")
    op.drop_column("procurement_project", "acceptance_requirements", schema="supplier")
    op.drop_column("procurement_project", "delivery_requirements", schema="supplier")
    op.drop_column("procurement_project", "service_requirements", schema="supplier")
    op.drop_column("procurement_project", "config_list", schema="supplier")
    op.drop_column("procurement_project", "tech_params", schema="supplier")
    op.drop_column("procurement_project", "department_name", schema="supplier")
    op.drop_column("procurement_project", "content", schema="supplier")
    op.drop_column("procurement_project", "budget_amount", schema="supplier")
    op.drop_column("procurement_project", "procurement_method", schema="supplier")
    op.drop_column("procurement_project", "category", schema="supplier")
    op.drop_column("procurement_project", "project_code", schema="supplier")
