"""Add first_name and last_name columns to users table."""

revision = "008"
down_revision = "007"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("users", sa.Column("first_name", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(128), nullable=True))


def downgrade():
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
