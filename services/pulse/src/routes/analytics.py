"""Analytics event and metrics endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.session import get_session

from services.pulse.src.repositories.event_repo import EventRepository
from services.pulse.src.schemas import (
    AnalyticsEventResponse,
    AnalyticsEventsListResponse,
    PipelineMetrics,
)
from services.pulse.src.services.event_aggregator import EventAggregator

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

# This will be set during app startup
_aggregator: EventAggregator | None = None


def set_aggregator(aggregator: EventAggregator) -> None:
    """Inject the EventAggregator instance (called from lifespan)."""
    global _aggregator  # noqa: PLW0603
    _aggregator = aggregator


@router.get("/events", response_model=AnalyticsEventsListResponse)
async def list_events(
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=200, description="Items per page"),
    channel: str | None = Query(default=None, description="Filter by channel"),
    service: str | None = Query(default=None, description="Filter by service"),
    hours: int | None = Query(default=None, ge=1, description="Events from last N hours"),
) -> AnalyticsEventsListResponse:
    """List analytics events with optional filtering and pagination."""
    repo = EventRepository(session)

    since = None
    if hours:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

    events, total = await repo.list_events(
        page=page,
        limit=limit,
        channel=channel,
        service=service,
        since=since,
    )

    return AnalyticsEventsListResponse(
        items=[
            AnalyticsEventResponse(
                id=e.id,
                channel=e.channel,
                payload=e.payload,
                service=e.service,
                timestamp=e.timestamp,
            )
            for e in events
        ],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/metrics", response_model=PipelineMetrics)
async def get_metrics(
    session: Annotated[AsyncSession, Depends(get_session)],
    hours: int = Query(default=24, ge=1, le=168, description="Metrics window in hours"),
) -> PipelineMetrics:
    """Get aggregated pipeline metrics (throughput, latency, error rates)."""
    if _aggregator is None:
        return PipelineMetrics()

    return await _aggregator.get_pipeline_metrics(session, hours=hours)
