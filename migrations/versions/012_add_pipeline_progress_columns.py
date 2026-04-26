"""Add pipeline progress columns to pipeline_runs.

Revision ID: 012
Revises: 011
"""

import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"


def upgrade() -> None:
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "stages_completed",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "stages_total",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("5"),
        ),
    )
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "current_stage_name",
            sa.String(50),
            nullable=True,
        ),
    )

    # Backfill: completed runs should show all stages done
    op.execute(
        "UPDATE pipeline_runs SET stages_completed = stages_total WHERE status = 'completed'"
    )


def downgrade() -> None:
    op.drop_column("pipeline_runs", "current_stage_name")
    op.drop_column("pipeline_runs", "stages_total")
    op.drop_column("pipeline_runs", "stages_completed")
