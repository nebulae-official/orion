"""Enforce NOT NULL on user foreign keys after backfill."""

revision = "007"
down_revision = "006"

from alembic import op


def upgrade():
    op.alter_column("contents", "created_by", nullable=False)
    op.alter_column("social_accounts", "user_id", nullable=False)


def downgrade():
    op.alter_column("contents", "created_by", nullable=True)
    op.alter_column("social_accounts", "user_id", nullable=True)
