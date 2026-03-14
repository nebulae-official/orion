"""Repository for analytics_events table."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from orion_common.db import Base
from sqlalchemy import DateTime, String, func, select
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# ORM Model
# ---------------------------------------------------------------------------


class AnalyticsEvent(Base):
    """Stores raw analytics events received from Redis pub/sub."""

    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channel: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    service: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class EventRepository:
    """Data access layer for analytics events."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        channel: str,
        payload: dict[str, Any],
        service: str,
    ) -> AnalyticsEvent:
        """Insert a new analytics event."""
        event = AnalyticsEvent(
            channel=channel,
            payload=payload,
            service=service,
            timestamp=datetime.now(UTC),
        )
        self._session.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        await logger.ainfo("event_stored", channel=channel, service=service)
        return event

    async def list_events(
        self,
        *,
        page: int = 1,
        limit: int = 50,
        channel: str | None = None,
        service: str | None = None,
        since: datetime | None = None,
    ) -> tuple[list[AnalyticsEvent], int]:
        """Return paginated events with optional filters."""
        query = select(AnalyticsEvent).order_by(AnalyticsEvent.timestamp.desc())

        if channel:
            query = query.where(AnalyticsEvent.channel == channel)
        if service:
            query = query.where(AnalyticsEvent.service == service)
        if since:
            query = query.where(AnalyticsEvent.timestamp >= since)

        # Total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        # Paginate
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        result = await self._session.execute(query)
        events = list(result.scalars().all())

        return events, total

    async def get_event_counts_by_channel(
        self,
        *,
        since: datetime | None = None,
    ) -> dict[str, int]:
        """Aggregate event counts grouped by channel."""
        query = select(
            AnalyticsEvent.channel,
            func.count().label("count"),
        ).group_by(AnalyticsEvent.channel)

        if since:
            query = query.where(AnalyticsEvent.timestamp >= since)

        result = await self._session.execute(query)
        return {row.channel: row.count for row in result.all()}

    async def get_throughput_per_hour(
        self,
        *,
        hours: int = 1,
    ) -> float:
        """Calculate events per hour over the last N hours."""
        since = datetime.now(UTC) - timedelta(hours=hours)
        query = select(func.count()).where(AnalyticsEvent.timestamp >= since)
        total = (await self._session.execute(query)).scalar_one()
        return total / hours if hours > 0 else 0.0

    async def get_error_trends(
        self,
        *,
        hours: int = 24,
        bucket_minutes: int = 60,
    ) -> list[dict[str, Any]]:
        """Return error rate trends bucketed by time intervals."""
        since = datetime.now(UTC) - timedelta(hours=hours)

        # All events since cutoff
        all_query = (
            select(
                func.date_trunc("hour", AnalyticsEvent.timestamp).label("bucket"),
                func.count().label("total_count"),
            )
            .where(AnalyticsEvent.timestamp >= since)
            .group_by("bucket")
            .order_by("bucket")
        )

        # Error events only
        error_query = (
            select(
                func.date_trunc("hour", AnalyticsEvent.timestamp).label("bucket"),
                func.count().label("error_count"),
            )
            .where(AnalyticsEvent.timestamp >= since)
            .where(AnalyticsEvent.channel.like("%failed%"))
            .group_by("bucket")
            .order_by("bucket")
        )

        all_result = await self._session.execute(all_query)
        error_result = await self._session.execute(error_query)

        all_rows = {str(r.bucket): r.total_count for r in all_result.all()}
        error_rows = {str(r.bucket): r.error_count for r in error_result.all()}

        trends: list[dict[str, Any]] = []
        for ts, total in all_rows.items():
            errors = error_rows.get(ts, 0)
            rate = errors / total if total > 0 else 0.0
            trends.append({
                "timestamp": ts,
                "error_count": errors,
                "total_count": total,
                "error_rate": round(rate, 4),
            })

        return trends
