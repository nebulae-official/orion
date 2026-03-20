"""Repository for Trend data access using async SQLAlchemy."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from orion_common.cache import RedisCache
from orion_common.db.models import Trend, TrendStatus
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)

TREND_LIST_CACHE_KEY = "scout:trends:active:{page}:{page_size}"
TREND_LIST_CACHE_TTL = 30  # seconds


class TrendRepository:
    """Async repository for Trend CRUD operations."""

    def __init__(
        self,
        session: AsyncSession,
        cache: RedisCache | None = None,
    ) -> None:
        self._session = session
        self._cache = cache

    async def create(self, trend_data: dict[str, Any]) -> Trend:
        """Insert a new trend record.

        Args:
            trend_data: Dictionary with topic, source, score, raw_data, etc.

        Returns:
            The newly created Trend ORM instance.
        """
        trend = Trend(**trend_data)
        self._session.add(trend)
        await self._session.flush()
        await self._session.refresh(trend)
        logger.info("trend_created", trend_id=str(trend.id), topic=trend.topic)
        # Invalidate list cache on create
        await self._invalidate_list_cache()
        return trend

    async def get_by_id(self, trend_id: uuid.UUID) -> Trend | None:
        """Fetch a single trend by its primary key."""
        result = await self._session.execute(select(Trend).where(Trend.id == trend_id))
        return result.scalar_one_or_none()

    async def get_active(self, page: int = 1, page_size: int = 20) -> tuple[list[Trend], int]:
        """Fetch active trends with pagination.

        Returns:
            Tuple of (trends_list, total_count).
        """
        base_query = select(Trend).where(Trend.status == TrendStatus.active)

        # Total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # Paginated results
        offset = (page - 1) * page_size
        query = (
            base_query.order_by(Trend.score.desc(), Trend.detected_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self._session.execute(query)
        trends = list(result.scalars().all())

        return trends, total

    async def get_filtered(
        self,
        page: int = 1,
        page_size: int = 20,
        source: str | None = None,
        date_from: datetime | None = None,
        status: str | None = None,
    ) -> tuple[list[Trend], int]:
        """Fetch trends with optional source, date, and status filters, paginated."""
        base_query = select(Trend)

        if source:
            sources = [s.strip() for s in source.split(",")]
            base_query = base_query.where(Trend.source.in_(sources))

        if date_from:
            base_query = base_query.where(Trend.detected_at >= date_from)

        if status:
            statuses = [s.strip() for s in status.split(",")]
            valid_statuses = [TrendStatus(s) for s in statuses if s in TrendStatus.__members__]
            if valid_statuses:
                base_query = base_query.where(Trend.status.in_(valid_statuses))

        # Total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # Paginated results
        offset = (page - 1) * page_size
        query = (
            base_query.order_by(Trend.score.desc(), Trend.detected_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self._session.execute(query)
        trends = list(result.scalars().all())

        return trends, total

    async def get_distinct_sources(self) -> list[str]:
        """Get all distinct source values from the trends table."""
        query = select(Trend.source).distinct().order_by(Trend.source)
        result = await self._session.execute(query)
        return [row[0] for row in result.all()]

    async def exists_by_topic(self, topic: str, hours: int = 24) -> bool:
        """Check if a trend with the same topic was detected recently.

        Used for deduplication — returns True if a matching topic
        already exists within the given time window.
        """
        cutoff = datetime.now(UTC) - timedelta(hours=hours)
        query = select(func.count()).where(
            Trend.topic == topic,
            Trend.detected_at >= cutoff,
        )
        result = await self._session.execute(query)
        count = result.scalar_one()
        return count > 0

    async def update_status(self, trend_id: uuid.UUID, status: TrendStatus) -> Trend | None:
        """Update the status of a trend.

        Returns:
            The updated Trend, or None if not found.
        """
        trend = await self.get_by_id(trend_id)
        if trend is None:
            return None

        trend.status = status
        if status in (TrendStatus.expired, TrendStatus.discarded):
            trend.expired_at = datetime.now(UTC)
        elif status == TrendStatus.active:
            trend.expired_at = None

        await self._session.flush()
        await self._session.refresh(trend)
        logger.info(
            "trend_status_updated",
            trend_id=str(trend_id),
            status=status.value,
        )
        # Invalidate list cache on status update
        await self._invalidate_list_cache()
        return trend

    async def _invalidate_list_cache(self) -> None:
        """Invalidate cached trend list entries."""
        if self._cache is None:
            return
        # Delete commonly-accessed first pages
        for page in range(1, 6):
            for page_size in (20, 50, 100):
                key = TREND_LIST_CACHE_KEY.format(page=page, page_size=page_size)
                await self._cache.delete(key)
