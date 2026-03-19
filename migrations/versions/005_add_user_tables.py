"""Add user management tables (users, oauth_accounts, user_settings, refresh_tokens).

Seeds a system user and an initial admin user from environment variables.

Revision ID: 005
Revises: 004
Create Date: 2026-03-19
"""

from __future__ import annotations

import os
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Well-known UUIDs for seeded users.
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_USER_ID = "00000000-0000-0000-0000-000000000002"


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("email", sa.String(512), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text, nullable=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("role", sa.String(32), nullable=False, server_default="viewer"),
        sa.Column("email_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])

    # --- oauth_accounts ---
    op.create_table(
        "oauth_accounts",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_user_id", sa.String(256), nullable=False),
        sa.Column("provider_email", sa.String(512), nullable=True),
        sa.Column("access_token", sa.Text, nullable=True),
        sa.Column("refresh_token", sa.Text, nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )
    op.create_index("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"])

    # --- user_settings ---
    op.create_table(
        "user_settings",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("settings", sa.dialects.postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # --- refresh_tokens ---
    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(512), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])

    # --- Seed system user ---
    op.execute(
        sa.text(
            """
            INSERT INTO users (id, email, name, role, email_verified, is_active)
            VALUES (
                CAST(:id AS uuid),
                'system@orion.internal',
                'System',
                'admin',
                true,
                true
            )
            """
        ).bindparams(id=SYSTEM_USER_ID)
    )

    # --- Seed initial admin user ---
    admin_email = os.environ.get("ORION_ADMIN_EMAIL", "admin@orion.local")
    admin_pass = os.environ.get("ORION_ADMIN_PASS", "")

    password_hash = None
    if admin_pass:
        import bcrypt

        password_hash = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode(
            "utf-8"
        )

    op.execute(
        sa.text(
            """
            INSERT INTO users (id, email, password_hash, name, role, email_verified, is_active)
            VALUES (
                CAST(:id AS uuid),
                :email,
                :password_hash,
                'Admin',
                'admin',
                true,
                true
            )
            """
        ).bindparams(
            id=ADMIN_USER_ID,
            email=admin_email,
            password_hash=password_hash,
        )
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("user_settings")
    op.drop_table("oauth_accounts")
    op.drop_table("users")
