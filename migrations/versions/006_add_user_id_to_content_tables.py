"""Add user ownership columns to contents and social_accounts tables.

Adds created_by FK to contents and user_id FK to social_accounts,
then backfills existing rows with the system user UUID.

Revision ID: 006
Revises: 005
Create Date: 2026-03-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    # --- contents.created_by ---
    op.add_column(
        "contents",
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_contents_created_by", "contents", ["created_by"])

    # --- social_accounts.user_id ---
    op.add_column(
        "social_accounts",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_social_accounts_user_id", "social_accounts", ["user_id"])

    # --- Backfill existing rows with system user ---
    op.execute(
        sa.text(f"UPDATE contents SET created_by = '{SYSTEM_USER_ID}' WHERE created_by IS NULL")
    )
    op.execute(
        sa.text(f"UPDATE social_accounts SET user_id = '{SYSTEM_USER_ID}' WHERE user_id IS NULL")
    )


def downgrade() -> None:
    op.drop_index("ix_social_accounts_user_id", table_name="social_accounts")
    op.drop_column("social_accounts", "user_id")
    op.drop_index("ix_contents_created_by", table_name="contents")
    op.drop_column("contents", "created_by")
