"""Add username column to users table.

Revision ID: 010
Revises: 009
"""

revision = "010"
down_revision = "009"

import re

import sqlalchemy as sa
from alembic import op


def _slugify(name: str) -> str:
    """Convert a name to a URL-safe username slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]", "_", slug)
    slug = re.sub(r"_+", "_", slug)
    slug = slug.strip("_")
    return slug[:30] if slug else "user"


def upgrade():
    op.add_column("users", sa.Column("username", sa.String(30), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # Backfill usernames for local (password-based) users only.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, name FROM users WHERE password_hash IS NOT NULL AND username IS NULL")
    ).fetchall()

    # Collect existing usernames to handle duplicates.
    existing: set[str] = set()
    for uid, name in rows:
        base = _slugify(name)
        candidate = base
        counter = 1
        while candidate in existing:
            suffix = f"_{counter}"
            candidate = base[: 30 - len(suffix)] + suffix
            counter += 1
        existing.add(candidate)
        conn.execute(
            sa.text("UPDATE users SET username = :uname WHERE id = :uid"),
            {"uname": candidate, "uid": uid},
        )


def downgrade():
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
