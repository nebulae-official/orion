"""Add performance indexes on frequently queried columns.

Revision ID: 004
Revises: 003
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Indexes to add: (index_name, table_name, column_name)
_INDEXES: list[tuple[str, str, str]] = [
    ("ix_contents_status", "contents", "status"),
    ("ix_contents_trend_id", "contents", "trend_id"),
    ("ix_pipeline_runs_content_id", "pipeline_runs", "content_id"),
    ("ix_pipeline_runs_status", "pipeline_runs", "status"),
]


def upgrade() -> None:
    for index_name, table_name, column_name in _INDEXES:
        op.create_index(
            index_name,
            table_name,
            [column_name],
            if_not_exists=True,
        )


def downgrade() -> None:
    for index_name, table_name, _column_name in reversed(_INDEXES):
        op.drop_index(index_name, table_name=table_name)
