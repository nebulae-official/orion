"""Add publisher tables — social_accounts, publish_records.

Revision ID: 002
Revises: 001
Create Date: 2026-03-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- social_accounts ---
    op.create_table(
        "social_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("platform", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("credentials", sa.Text, nullable=False),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- publish_records ---
    op.create_table(
        "publish_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "content_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contents.id"),
            nullable=False,
        ),
        sa.Column(
            "social_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_accounts.id"),
            nullable=True,
        ),
        sa.Column("platform", sa.String(128), nullable=False),
        sa.Column("platform_post_id", sa.String(512), nullable=True),
        sa.Column(
            "status",
            sa.Enum("published", "failed", name="publish_status"),
            nullable=False,
            server_default="failed",
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- indexes ---
    op.create_index(
        "ix_social_accounts_platform", "social_accounts", ["platform"]
    )
    op.create_index(
        "ix_publish_records_content_id", "publish_records", ["content_id"]
    )
    op.create_index(
        "ix_publish_records_social_account_id",
        "publish_records",
        ["social_account_id"],
    )
    op.create_index(
        "ix_publish_records_platform", "publish_records", ["platform"]
    )


def downgrade() -> None:
    op.drop_table("publish_records")
    op.drop_table("social_accounts")

    op.execute("DROP TYPE IF EXISTS publish_status")
