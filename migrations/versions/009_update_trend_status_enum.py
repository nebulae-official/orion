"""Update trend_status enum: add 'used' and 'discarded', remove 'archived'.

Revision ID: 009
Revises: 008
"""

revision = "009"
down_revision = "008"

from alembic import op


def upgrade():
    # Add new enum values to the PostgreSQL enum type.
    # PostgreSQL enums are modified with ALTER TYPE ... ADD VALUE.
    op.execute("ALTER TYPE trend_status ADD VALUE IF NOT EXISTS 'used'")
    op.execute("ALTER TYPE trend_status ADD VALUE IF NOT EXISTS 'discarded'")

    # Migrate any existing 'archived' rows to 'discarded' before removing.
    op.execute("UPDATE trends SET status = 'discarded' WHERE status = 'archived'")

    # Note: PostgreSQL does not support DROP VALUE from enums directly.
    # 'archived' remains in the enum type but is no longer used by the app.
    # To fully remove it, a type recreation would be needed, which requires
    # rewriting the column — deferred to avoid risk in production.


def downgrade():
    # Reverse: move 'discarded' back to 'archived'
    op.execute("UPDATE trends SET status = 'archived' WHERE status = 'discarded'")
    # Move 'used' back to 'active'
    op.execute("UPDATE trends SET status = 'active' WHERE status = 'used'")
    # Note: Cannot remove enum values in PostgreSQL without type recreation.
