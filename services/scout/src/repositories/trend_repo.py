"""Repository for Trend data access using async SQLAlchemy."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import Trend, TrendStatus

logger = structlog.get_logger(__name__)


class TrendRepository:
    """Async repository for Trend CRUD operations."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

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
        return trend

    async def get_by_id(self, trend_id: uuid.UUID) -> Trend | None:
        """Fetch a single trend by its primary key."""
        result = await self._session.execute(
            select(Trend).where(Trend.id == trend_id)
        )
        return result.scalar_one_or_none()

    async def get_active(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[Trend], int]:
        """Fetch active trends with pagination.

        Returns:
            Tuple of (trends_list, total_count).
        """
        base_query = select(Trend).where(Trend.status == TrendStatus.active)

        # Total count
        count_query = select(func.count()).select_from(
            base_query.subquery()
        )
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # Paginated results
        offset = (page - 1) * page_size
        query = (
            base_query
            .order_by(Trend.score.desc(), Trend.detected_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self._session.execute(query)
        trends = list(result.scalars().all())

        return trends, total

    async def exists_by_topic(
        self, topic: str, hours: int = 24
    ) -> bool:
        """Check if a trend with the same topic was detected recently.

        Used for deduplication — returns True if a matching topic
        already exists within the given time window.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = select(func.count()).where(
            Trend.topic == topic,
            Trend.detected_at >= cutoff,
        )
        result = await self._session.execute(query)
        count = result.scalar_one()
        return count > 0

    async def update_status(
        self, trend_id: uuid.UUID, status: TrendStatus
    ) -> Trend | None:
        """Update the status of a trend.

        Returns:
            The updated Trend, or None if not found.
        """
        trend = await self.get_by_id(trend_id)
        if trend is None:
            return None

        trend.status = status
        if status == TrendStatus.expired:
            trend.expired_at = datetime.now(timezone.utc)

        await self._session.flush()
        await self._session.refresh(trend)
        logger.info(
            "trend_status_updated",
            trend_id=str(trend_id),
            status=status.value,
        )
        return trend
