"""PostgreSQL：identity schema · 院内用户账号与 RBAC（Phase 0）。

对齐：docs/01_需求文档/03_角色权限与数据安全架构设计.md
接口：`POST /api/v1/auth/login`、签发 JWT、`GET /api/v1/auth/me`。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "e005_identity_auth"
down_revision = "e004_audit_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "e005_identity_auth 仅支持 PostgreSQL（schema `identity`）。\n"
            "请在 PostgreSQL 上执行 alembic upgrade head。"
        )

    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS identity"))

    op.create_table(
        "app_user",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=128)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("username", name="uq_identity_app_user_username"),
        schema="identity",
    )

    op.create_table(
        "user_role",
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("role_code", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["identity.app_user.id"],
            name="fk_identity_user_role_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "role_code", name="pk_identity_user_role"),
        schema="identity",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.drop_table("user_role", schema="identity")
    op.drop_table("app_user", schema="identity")
    op.execute(sa.text("DROP SCHEMA IF EXISTS identity CASCADE"))
