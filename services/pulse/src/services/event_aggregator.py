"""Event aggregator that subscribes to all orion:* Redis channels.

Collects events from the event bus, persists them, and calculates
pipeline metrics (throughput, latency per stage, error rates).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orion_common.db import PipelineRun, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from services.pulse.src.metrics import TRENDS_DISCARDED, TRENDS_FOUND, TRENDS_USED
from services.pulse.src.repositories.event_repo import AnalyticsEvent, EventRepository
from services.pulse.src.schemas import PipelineMetrics, StageMetric

logger = structlog.get_logger(__name__)

# All channels the aggregator listens to
_ALL_CHANNELS: list[str] = [
    Channels.CONTENT_CREATED,
    Channels.CONTENT_UPDATED,
    Channels.CONTENT_PUBLISHED,
    Channels.TREND_DETECTED,
    Channels.TREND_EXPIRED,
    Channels.MEDIA_GENERATED,
    Channels.MEDIA_FAILED,
    Channels.PIPELINE_STAGE_CHANGED,
]

# Map channel names to originating service
_CHANNEL_SERVICE_MAP: dict[str, str] = {
    Channels.CONTENT_CREATED: "director",
    Channels.CONTENT_UPDATED: "editor",
    Channels.CONTENT_PUBLISHED: "editor",
    Channels.TREND_DETECTED: "scout",
    Channels.TREND_EXPIRED: "scout",
    Channels.MEDIA_GENERATED: "media",
    Channels.MEDIA_FAILED: "media",
    Channels.PIPELINE_STAGE_CHANGED: "director",
}


class EventAggregator:
    """Subscribes to Redis event bus channels and persists analytics events.

    Also provides methods to compute pipeline metrics from stored data.
    """

    def __init__(
        self,
        event_bus: EventBus,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._event_bus = event_bus
        self._session_factory = session_factory

    async def start(self) -> None:
        """Subscribe to all orion channels and start listening."""
        for channel in _ALL_CHANNELS:
            await self._event_bus.subscribe(channel, self._handle_event)
        await self._event_bus.start_listening()
        await logger.ainfo("event_aggregator_started", channels=len(_ALL_CHANNELS))

    async def _handle_event(self, data: dict[str, Any]) -> None:
        """Handle an incoming event by persisting it and updating metrics."""
        channel = data.get("_channel", "unknown")
        service = _CHANNEL_SERVICE_MAP.get(channel, data.get("service", "unknown"))

        # Update Prometheus trend counters
        source = data.get("source", "unknown")
        if channel == Channels.TREND_DETECTED:
            TRENDS_FOUND.labels(source=source).inc()
        elif channel == Channels.TREND_EXPIRED:
            TRENDS_DISCARDED.labels(source=source, reason="expired").inc()
        elif channel == Channels.CONTENT_CREATED:
            TRENDS_USED.labels(source=source).inc()

        async with self._session_factory() as session:
            repo = EventRepository(session)
            await repo.create(
                channel=channel,
                payload=data,
                service=service,
            )

    async def get_pipeline_metrics(
        self,
        session: AsyncSession,
        *,
        hours: int = 24,
    ) -> PipelineMetrics:
        """Calculate pipeline metrics from PipelineRun records."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Stage-level metrics
        query = (
            select(
                PipelineRun.stage,
                func.count().label("total"),
                func.count()
                .filter(PipelineRun.status == PipelineStatus.completed)
                .label("completed"),
                func.count()
                .filter(PipelineRun.status == PipelineStatus.failed)
                .label("failed"),
                func.avg(
                    func.extract(
                        "epoch",
                        PipelineRun.completed_at - PipelineRun.started_at,
                    )
                ).label("avg_latency"),
            )
            .where(PipelineRun.started_at >= since)
            .group_by(PipelineRun.stage)
        )

        result = await session.execute(query)
        rows = result.all()

        stages: list[StageMetric] = []
        total_all = 0
        failed_all = 0
        for row in rows:
            stages.append(
                StageMetric(
                    stage=row.stage,
                    total_runs=row.total,
                    completed=row.completed,
                    failed=row.failed,
                    avg_latency_seconds=round(float(row.avg_latency or 0), 2),
                )
            )
            total_all += row.total
            failed_all += row.failed

        # Throughput: completed runs per hour
        event_repo = EventRepository(session)
        throughput = await event_repo.get_throughput_per_hour(hours=hours)

        error_rate = failed_all / total_all if total_all > 0 else 0.0

        return PipelineMetrics(
            throughput_per_hour=round(throughput, 2),
            error_rate=round(error_rate, 4),
            stages=stages,
        )
