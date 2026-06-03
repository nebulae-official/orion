"""Create analytics_events table for Pulse service event storage.

Revision ID: 017
Revises: 016
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "017"
down_revision = "016"


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("channel", sa.String(256), nullable=False),
        sa.Column("payload", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("service", sa.String(128), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_analytics_events_channel", "analytics_events", ["channel"])
    op.create_index("ix_analytics_events_service", "analytics_events", ["service"])
    op.create_index("ix_analytics_events_timestamp", "analytics_events", ["timestamp"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_timestamp", table_name="analytics_events")
    op.drop_index("ix_analytics_events_service", table_name="analytics_events")
    op.drop_index("ix_analytics_events_channel", table_name="analytics_events")
    op.drop_table("analytics_events")
