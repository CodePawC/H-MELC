"""compatibility alias for legacy H-UMDG revision

Revision ID: e020_hmdm_integration
Revises: e020_repair_center
Create Date: 2026-05-27
"""

from __future__ import annotations


revision = "e020_hmdm_integration"
down_revision = "e020_repair_center"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Legacy databases may already be stamped with this revision id."""


def downgrade() -> None:
    """No schema changes are associated with this compatibility revision."""
