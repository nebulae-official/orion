"""Pipeline health dashboard data endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from orion_common.auth import CurrentUser, get_current_user
from orion_common.db import Content, ContentStatus
from orion_common.db.session import get_session
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.cost_repo import CostRepository
from src.repositories.event_repo import EventRepository
from src.schemas import (
    CostProjection,
    ErrorTrend,
    FunnelMetrics,
    ProviderUsage,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"])


@router.get("/funnel", response_model=FunnelMetrics)
async def get_funnel(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
) -> FunnelMetrics:
    """Content funnel metrics: generated -> review -> approved -> published."""
    query = select(
        Content.status,
        func.count().label("count"),
    ).group_by(Content.status)

    if not user.is_admin:
        query = query.where(Content.created_by == user.user_id)

    result = await session.execute(query)
    counts: dict[str, int] = {row.status.value: row.count for row in result.all()}

    # "generated" includes all non-draft statuses
    generated = sum(counts.values())

    return FunnelMetrics(
        generated=generated,
        review=counts.get(ContentStatus.review.value, 0),
        approved=counts.get(ContentStatus.approved.value, 0),
        published=counts.get(ContentStatus.published.value, 0),
        rejected=counts.get(ContentStatus.rejected.value, 0),
    )


@router.get("/providers", response_model=list[ProviderUsage])
async def get_provider_usage(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
    days: int = Query(default=30, ge=1, le=365, description="Window in days"),
) -> list[ProviderUsage]:
    """Provider usage breakdown with request counts and costs."""
    repo = CostRepository(session)
    since = datetime.now(UTC) - timedelta(days=days)
    provider_data = await repo.get_costs_by_provider(since=since)

    # Count errors from event repo
    event_repo = EventRepository(session)
    error_counts = await event_repo.get_event_counts_by_channel(since=since)
    sum(v for k, v in error_counts.items() if "failed" in k)

    result: list[ProviderUsage] = []
    for p in provider_data:
        result.append(
            ProviderUsage(
                provider=p["provider"],
                request_count=p.get("request_count", 0),
                total_cost=p["total_cost"],
                error_count=0,  # per-provider errors not yet tracked
            )
        )

    return result


@router.get("/errors", response_model=list[ErrorTrend])
async def get_error_trends(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history"),
) -> list[ErrorTrend]:
    """Error rate trends over time."""
    repo = EventRepository(session)
    trends = await repo.get_error_trends(hours=hours)
    return [ErrorTrend(**t) for t in trends]


@router.get("/costs", response_model=list[CostProjection])
async def get_cost_projections(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
    days: int = Query(default=7, ge=1, le=30, description="Days of history for projection"),
) -> list[CostProjection]:
    """Cost projections for daily, weekly, and monthly periods."""
    repo = CostRepository(session)
    projections = await repo.get_cost_projection(days_history=days)
    return [CostProjection(**p) for p in projections]
