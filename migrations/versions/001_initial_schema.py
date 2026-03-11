"""Initial schema — trends, contents, media_assets, providers, pipeline_runs.

Revision ID: 001
Revises:
Create Date: 2026-03-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- trends ---
    op.create_table(
        "trends",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("topic", sa.String(512), nullable=False),
        sa.Column("source", sa.String(256), nullable=False),
        sa.Column("score", sa.Float, nullable=False, server_default="0"),
        sa.Column("raw_data", JSON, nullable=True),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "expired", "archived", name="trend_status"),
            nullable=False,
            server_default="active",
        ),
    )

    # --- contents ---
    op.create_table(
        "contents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "trend_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trends.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("script_body", sa.Text, nullable=True),
        sa.Column("hook", sa.String(1024), nullable=True),
        sa.Column("visual_prompts", JSON, nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "generating",
                "review",
                "approved",
                "published",
                "rejected",
                name="content_status",
            ),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- media_assets ---
    op.create_table(
        "media_assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "content_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contents.id"),
            nullable=False,
        ),
        sa.Column(
            "asset_type",
            sa.Enum("image", "video", "audio", name="asset_type"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(256), nullable=False),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- providers ---
    op.create_table(
        "providers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(256), unique=True, nullable=False),
        sa.Column("provider_type", sa.String(128), nullable=False),
        sa.Column("config", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "priority", sa.Integer, nullable=False, server_default="0"
        ),
    )

    # --- pipeline_runs ---
    op.create_table(
        "pipeline_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "content_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contents.id"),
            nullable=False,
        ),
        sa.Column("stage", sa.String(128), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "running", "completed", "failed", name="pipeline_status"
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
    )

    # --- indexes ---
    op.create_index("ix_trends_status", "trends", ["status"])
    op.create_index("ix_trends_detected_at", "trends", ["detected_at"])
    op.create_index("ix_contents_status", "contents", ["status"])
    op.create_index("ix_contents_trend_id", "contents", ["trend_id"])
    op.create_index("ix_media_assets_content_id", "media_assets", ["content_id"])
    op.create_index("ix_pipeline_runs_content_id", "pipeline_runs", ["content_id"])
    op.create_index("ix_pipeline_runs_status", "pipeline_runs", ["status"])


def downgrade() -> None:
    op.drop_table("pipeline_runs")
    op.drop_table("media_assets")
    op.drop_table("providers")
    op.drop_table("contents")
    op.drop_table("trends")

    # Drop enums created by the upgrade
    op.execute("DROP TYPE IF EXISTS pipeline_status")
    op.execute("DROP TYPE IF EXISTS asset_type")
    op.execute("DROP TYPE IF EXISTS content_status")
    op.execute("DROP TYPE IF EXISTS trend_status")
