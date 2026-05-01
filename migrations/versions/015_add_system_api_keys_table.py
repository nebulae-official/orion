"""Add system_api_keys table for admin-managed provider API keys.

Revision ID: 015
Revises: 014
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "015"
down_revision = "014"


def upgrade() -> None:
    op.create_table(
        "system_api_keys",
        sa.Column("provider", sa.String(64), primary_key=True),
        sa.Column("encrypted_key", sa.Text, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("system_api_keys")
