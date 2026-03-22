"""APScheduler-based scheduled trend ingestion for the Scout service."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from apscheduler import AsyncScheduler
from apscheduler.triggers.interval import IntervalTrigger
from orion_common.db.models import Trend, TrendStatus
from orion_common.db.session import get_session
from orion_common.event_bus import EventBus
from orion_common.events import Channels
from sqlalchemy import select

from src.filters.deduplication import TrendDeduplicator
from src.filters.niche_filter import NicheConfig, NicheFilter
from src.providers.base import TrendProvider, TrendResult
from src.repositories.trend_repo import TrendRepository

logger = structlog.get_logger(__name__)

# Default scan interval in minutes
DEFAULT_INTERVAL_MINUTES = 30
# Max trends to expire per run
EXPIRE_BATCH_LIMIT = 100


async def expire_old_trends(event_bus: EventBus) -> int:
    """Mark active trends older than ``SCOUT_TREND_EXPIRY_DAYS`` as expired.

    Publishes a ``TREND_EXPIRED`` event for each expired trend.
    Processes at most ``EXPIRE_BATCH_LIMIT`` trends per invocation.

    Returns:
        Number of trends expired.
    """
    expiry_days = int(os.getenv("SCOUT_TREND_EXPIRY_DAYS", "7"))
    cutoff = datetime.now(UTC) - timedelta(days=expiry_days)
    expired_count = 0

    async for session in get_session():
        stmt = (
            select(Trend)
            .where(
                Trend.status == TrendStatus.active,
                Trend.detected_at < cutoff,
            )
            .order_by(Trend.detected_at.asc())
            .limit(EXPIRE_BATCH_LIMIT)
        )
        result = await session.execute(stmt)
        old_trends = list(result.scalars().all())

        if not old_trends:
            logger.info("no_trends_to_expire")
            return 0

        repo = TrendRepository(session)
        for trend in old_trends:
            await repo.update_status(trend.id, TrendStatus.expired)
            await event_bus.publish(
                Channels.TREND_EXPIRED,
                {
                    "trend_id": str(trend.id),
                    "topic": trend.topic,
                    "source": trend.source,
                    "detected_at": trend.detected_at.isoformat(),
                    "expired_at": datetime.now(UTC).isoformat(),
                },
            )
            expired_count += 1

        await session.commit()

    logger.info(
        "trend_expiration_complete",
        expired=expired_count,
        cutoff_days=expiry_days,
    )
    return expired_count


async def fetch_and_process_trends(
    providers: list[TrendProvider],
    niche_filter: NicheFilter,
    niche_config: NicheConfig,
    event_bus: EventBus,
    region: str = "US",
    limit: int = 20,
    deduplicator: TrendDeduplicator | None = None,
) -> tuple[int, int]:
    """Core ingestion pipeline: fetch, deduplicate, filter, persist, publish.

    Args:
        providers: Trend data providers to query.
        niche_filter: Filter instance for niche-based scoring.
        niche_config: Active niche configuration.
        event_bus: Redis event bus for publishing events.
        region: Geographic region for trend fetching.
        limit: Max trends per provider.
        deduplicator: Optional deduplicator for fuzzy matching.

    Returns:
        Tuple of (total_trends_found, trends_saved).
    """
    # 1. Fetch from all providers
    all_trends: list[TrendResult] = []
    for provider in providers:
        try:
            results = await provider.fetch_trends(region=region, limit=limit)
            all_trends.extend(results)
        except Exception:
            logger.exception(
                "provider_fetch_error",
                provider=type(provider).__name__,
            )

    if not all_trends:
        logger.info("no_trends_fetched")
        return 0, 0

    total_found = len(all_trends)

    # 2. Apply deduplication before niche filter
    if deduplicator is not None:
        all_trends = deduplicator.deduplicate(all_trends)

    # 3. Apply niche filter
    filtered = niche_filter.filter_trends(all_trends, niche_config)

    # 4. Persist and publish
    saved_count = 0
    async for session in get_session():
        repo = TrendRepository(session)

        for trend in filtered:
            try:
                # Check for recent duplicates
                if await repo.exists_by_topic(trend.topic, hours=24):
                    logger.debug("trend_duplicate_skipped", topic=trend.topic)
                    continue

                # Save to database
                db_trend = await repo.create(
                    {
                        "topic": trend.topic,
                        "source": trend.source,
                        "score": trend.score,
                        "raw_data": trend.raw_data,
                    }
                )
                saved_count += 1

                # 4. Publish TrendDetected event
                event_payload: dict[str, Any] = {
                    "trend_id": str(db_trend.id),
                    "topic": db_trend.topic,
                    "source": db_trend.source,
                    "score": db_trend.score,
                    "detected_at": db_trend.detected_at.isoformat(),
                }
                await event_bus.publish(Channels.TREND_DETECTED, event_payload)
            except Exception:
                logger.exception(
                    "trend_save_error",
                    topic=trend.topic,
                )

        await session.commit()

    logger.info(
        "trend_ingestion_complete",
        total_found=total_found,
        saved=saved_count,
    )
    return total_found, saved_count


class TrendScheduler:
    """Manages scheduled trend ingestion jobs via APScheduler.

    Wraps an ``AsyncScheduler`` and provides start/stop lifecycle
    methods suitable for integration with FastAPI lifespan.
    """

    def __init__(
        self,
        providers: list[TrendProvider],
        niche_filter: NicheFilter,
        niche_config: NicheConfig,
        event_bus: EventBus,
        interval_minutes: int = DEFAULT_INTERVAL_MINUTES,
        region: str = "US",
        limit: int = 20,
        deduplicator: TrendDeduplicator | None = None,
    ) -> None:
        self._providers = providers
        self._niche_filter = niche_filter
        self._niche_config = niche_config
        self._event_bus = event_bus
        self._interval_minutes = interval_minutes
        self._region = region
        self._limit = limit
        self._deduplicator = deduplicator
        self._scheduler: AsyncScheduler | None = None

    async def _scheduled_job(self) -> None:
        """Job callback invoked on each scheduled tick."""
        logger.info("scheduled_scan_starting")
        try:
            await fetch_and_process_trends(
                providers=self._providers,
                niche_filter=self._niche_filter,
                niche_config=self._niche_config,
                event_bus=self._event_bus,
                region=self._region,
                limit=self._limit,
                deduplicator=self._deduplicator,
            )
        except Exception:
            logger.exception("scheduled_scan_error")

    async def _expiration_job(self) -> None:
        """Job callback for expiring old trends every 6 hours."""
        logger.info("trend_expiration_starting")
        try:
            await expire_old_trends(self._event_bus)
        except Exception:
            logger.exception("trend_expiration_error")

    async def start(self) -> None:
        """Start the scheduler with the configured interval."""
        self._scheduler = AsyncScheduler()
        await self._scheduler.__aenter__()
        await self._scheduler.add_schedule(
            self._scheduled_job,
            IntervalTrigger(minutes=self._interval_minutes),
            id="trend_ingestion",
        )
        await self._scheduler.add_schedule(
            self._expiration_job,
            IntervalTrigger(hours=6),
            id="trend_expiration",
        )
        await self._scheduler.start_in_background()
        logger.info(
            "scheduler_started",
            interval_minutes=self._interval_minutes,
        )

    async def shutdown(self) -> None:
        """Gracefully stop the scheduler."""
        if self._scheduler is not None:
            await self._scheduler.__aexit__(None, None, None)
            self._scheduler = None
            logger.info("scheduler_stopped")
