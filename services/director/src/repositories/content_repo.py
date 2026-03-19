"""Async repository for Content and PipelineRun records."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from orion_common.cache import RedisCache
from orion_common.db.models import Content, ContentStatus, PipelineRun, PipelineStatus
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

CONTENT_LIST_CACHE_KEY = "director:content:list:{status}:{limit}:{offset}"
CONTENT_LIST_CACHE_TTL = 30  # seconds


class ContentRepository:
    """Data-access layer for the ``contents`` and ``pipeline_runs`` tables."""

    def __init__(
        self,
        session: AsyncSession,
        cache: RedisCache | None = None,
    ) -> None:
        self._session = session
        self._cache = cache

    # ------------------------------------------------------------------
    # Content CRUD
    # ------------------------------------------------------------------

    async def create(
        self,
        trend_id: uuid.UUID,
        title: str,
        script_body: str | None = None,
        hook: str | None = None,
        visual_prompts: dict | None = None,
        status: ContentStatus = ContentStatus.draft,
        created_by: uuid.UUID | None = None,
    ) -> Content:
        """Insert a new Content row and return it."""
        content = Content(
            trend_id=trend_id,
            title=title,
            script_body=script_body,
            hook=hook,
            visual_prompts=visual_prompts,
            status=status,
            created_by=created_by,
        )
        self._session.add(content)
        await self._session.flush()
        await self._invalidate_list_cache()
        return content

    async def get_by_id(self, content_id: uuid.UUID) -> Content | None:
        """Fetch a single Content by primary key."""
        return await self._session.get(Content, content_id)

    async def update_status(
        self,
        content_id: uuid.UUID,
        status: ContentStatus,
    ) -> Content | None:
        """Update the status of an existing Content row."""
        content = await self.get_by_id(content_id)
        if content is None:
            return None
        content.status = status
        await self._session.flush()
        await self._invalidate_list_cache()
        return content

    async def update_content(
        self,
        content_id: uuid.UUID,
        *,
        script_body: str | None = None,
        hook: str | None = None,
        visual_prompts: dict | None = None,
        status: ContentStatus | None = None,
    ) -> Content | None:
        """Partially update a Content row."""
        content = await self.get_by_id(content_id)
        if content is None:
            return None
        if script_body is not None:
            content.script_body = script_body
        if hook is not None:
            content.hook = hook
        if visual_prompts is not None:
            content.visual_prompts = visual_prompts
        if status is not None:
            content.status = status
        await self._session.flush()
        await self._invalidate_list_cache()
        return content

    async def list_by_status(
        self,
        status: ContentStatus | None = None,
        limit: int = 50,
        offset: int = 0,
        user_id: uuid.UUID | None = None,
    ) -> list[Content]:
        """Return content rows, optionally filtered by status and owner."""
        stmt = select(Content).order_by(Content.created_at.desc())
        if status is not None:
            stmt = stmt.where(Content.status == status)
        if user_id is not None:
            stmt = stmt.where(Content.created_by == user_id)
        stmt = stmt.limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # PipelineRun helpers
    # ------------------------------------------------------------------

    async def create_pipeline_run(
        self,
        content_id: uuid.UUID,
        stage: str,
    ) -> PipelineRun:
        """Create a new pipeline run record."""
        run = PipelineRun(
            content_id=content_id,
            stage=stage,
            status=PipelineStatus.pending,
        )
        self._session.add(run)
        await self._session.flush()
        return run

    async def update_pipeline_run(
        self,
        run_id: uuid.UUID,
        status: PipelineStatus,
        error_message: str | None = None,
    ) -> PipelineRun | None:
        """Update a pipeline run's status."""
        run = await self._session.get(PipelineRun, run_id)
        if run is None:
            return None
        run.status = status
        if status == PipelineStatus.running:
            run.started_at = datetime.now(UTC)
        elif status in (PipelineStatus.completed, PipelineStatus.failed):
            run.completed_at = datetime.now(UTC)
        if error_message is not None:
            run.error_message = error_message
        await self._session.flush()
        return run

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    async def _invalidate_list_cache(self) -> None:
        """Invalidate cached content list entries."""
        if self._cache is None:
            return
        # Delete commonly-accessed cache keys
        for status_val in [None, *ContentStatus]:
            status_str = status_val.value if status_val else "all"
            for limit in (50, 100, 200):
                for offset in (0, 50, 100):
                    key = CONTENT_LIST_CACHE_KEY.format(status=status_str, limit=limit, offset=offset)
                    await self._cache.delete(key)
