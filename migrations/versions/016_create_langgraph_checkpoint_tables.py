"""Create LangGraph checkpoint tables for Director pipeline state.

Revision ID: 016
Revises: 015

These tables are managed by langgraph-checkpoint-postgres internally but
must be created deterministically at deploy time rather than auto-created
at service startup. The Director's AsyncPostgresSaver.setup() call is
retained as an idempotent no-op (all statements use IF NOT EXISTS) but
this migration is the authoritative source for cold-start DDL.
"""

from __future__ import annotations

from alembic import op

revision = "016"
down_revision = "015"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS checkpoint_migrations (
            v INTEGER PRIMARY KEY
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS checkpoints (
            thread_id          TEXT NOT NULL,
            checkpoint_ns      TEXT NOT NULL DEFAULT '',
            checkpoint_id      TEXT NOT NULL,
            parent_checkpoint_id TEXT,
            type               TEXT,
            checkpoint         JSONB NOT NULL,
            metadata           JSONB NOT NULL DEFAULT '{}',
            PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS checkpoint_blobs (
            thread_id     TEXT NOT NULL,
            checkpoint_ns TEXT NOT NULL DEFAULT '',
            channel       TEXT NOT NULL,
            version       TEXT NOT NULL,
            type          TEXT NOT NULL,
            blob          BYTEA,
            PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS checkpoint_writes (
            thread_id     TEXT NOT NULL,
            checkpoint_ns TEXT NOT NULL DEFAULT '',
            checkpoint_id TEXT NOT NULL,
            task_id       TEXT NOT NULL,
            task_path     TEXT NOT NULL DEFAULT '',
            idx           INTEGER NOT NULL,
            channel       TEXT NOT NULL,
            type          TEXT,
            blob          BYTEA NOT NULL,
            PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
        )
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS checkpoints_thread_id_idx ON checkpoints(thread_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS checkpoint_blobs_thread_id_idx ON checkpoint_blobs(thread_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS checkpoint_writes_thread_id_idx ON checkpoint_writes(thread_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS checkpoint_writes_thread_id_idx")
    op.execute("DROP INDEX IF EXISTS checkpoint_blobs_thread_id_idx")
    op.execute("DROP INDEX IF EXISTS checkpoints_thread_id_idx")
    op.drop_table("checkpoint_writes")
    op.drop_table("checkpoint_blobs")
    op.drop_table("checkpoints")
    op.drop_table("checkpoint_migrations")
