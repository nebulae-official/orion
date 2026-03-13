"""Add performance indexes to existing tables.

Revision ID: 003
Revises: 002
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_contents_created_at", "contents", ["created_at"])
    op.create_index("ix_trends_topic", "trends", ["topic"])


def downgrade() -> None:
    op.drop_index("ix_trends_topic", table_name="trends")
    op.drop_index("ix_contents_created_at", table_name="contents")
