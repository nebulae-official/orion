# Migrations

Database schema migrations are managed with [Alembic](https://alembic.sqlalchemy.org/) using SQLAlchemy 2.0 models.

## :material-folder-outline: Structure

```
migrations/
  alembic.ini       # Alembic configuration
  env.py            # Migration environment setup
  versions/         # Migration scripts (auto-generated)
```

## :material-play: Running Migrations

### Apply all pending migrations

```bash
alembic upgrade head
```

### Rollback one migration

```bash
alembic downgrade -1
```

### Show current revision

```bash
alembic current
```

### Show migration history

```bash
alembic history --verbose
```

## :material-plus: Creating a New Migration

### Auto-generate from model changes

```bash
alembic revision --autogenerate -m "add publish_records table"
```

This compares the current database schema against your SQLAlchemy models and generates a migration script.

### Manual migration

```bash
alembic revision -m "add index on trends.score"
```

Then edit the generated file in `migrations/versions/`.

## :material-database: Connection Configuration

Alembic uses the synchronous database URL from `CommonSettings`:

```python
# In migrations/env.py
from orion_common.config import get_settings

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url_sync)
```

| URL Type          | Property                     | Driver     |
| ----------------- | ---------------------------- | ---------- |
| Async (app)       | `settings.database_url`      | `asyncpg`  |
| Sync (migrations) | `settings.database_url_sync` | `psycopg2` |

## :material-file-document: Migration Script Template

```python
"""Add publish_records table.

Revision ID: abc123
Revises: def456
Create Date: 2024-03-12 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "abc123"
down_revision: Union[str, None] = "def456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "publish_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("content_id", sa.UUID(), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["content_id"], ["contents.id"]),
    )


def downgrade() -> None:
    op.drop_table("publish_records")
```

## :material-alert: Best Practices

!!! warning "Always review auto-generated migrations"
Alembic's autogenerate can miss certain changes (e.g., column renames are detected as drop + add). Always review generated scripts before applying.

- Test migrations against a fresh database and a populated database
- Never modify a migration that has been applied to production
- Include both `upgrade()` and `downgrade()` functions
- Use descriptive migration messages
