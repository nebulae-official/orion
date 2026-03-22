"""Create provider_costs table with user_id column.

Revision ID: 013
Revises: 012
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "013"
down_revision = "012"


def upgrade() -> None:
    op.create_table(
        "provider_costs",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("provider", sa.String(256), nullable=False),
        sa.Column("category", sa.String(128), nullable=False),
        sa.Column("amount", sa.Float, nullable=False, server_default=sa.text("0.0")),
        sa.Column("units", sa.Float, nullable=False, server_default=sa.text("0.0")),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metadata", sa.JSON, nullable=True),
        sa.Column(
            "recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    op.create_index("ix_provider_costs_provider", "provider_costs", ["provider"])
    op.create_index("ix_provider_costs_category", "provider_costs", ["category"])
    op.create_index(
        "ix_provider_costs_user_id_recorded_at", "provider_costs", ["user_id", "recorded_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_provider_costs_user_id_recorded_at", table_name="provider_costs")
    op.drop_index("ix_provider_costs_category", table_name="provider_costs")
    op.drop_index("ix_provider_costs_provider", table_name="provider_costs")
    op.drop_table("provider_costs")
