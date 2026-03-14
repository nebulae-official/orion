"""Data retention cleanup for Pulse analytics tables."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.cost_repo import ProviderCost
from src.repositories.event_repo import AnalyticsEvent

logger = structlog.get_logger(__name__)


async def cleanup_old_records(
    session: AsyncSession,
    retention_days: int = 90,
) -> dict[str, int]:
    """Delete analytics_events and provider_costs older than retention_days.

    Args:
        session: Async database session.
        retention_days: Number of days to retain. Records older are deleted.

    Returns:
        Dict with counts of deleted events and costs.
    """
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)

    events_result = await session.execute(
        delete(AnalyticsEvent).where(AnalyticsEvent.recorded_at < cutoff)
    )
    costs_result = await session.execute(
        delete(ProviderCost).where(ProviderCost.recorded_at < cutoff)
    )
    await session.commit()

    deleted = {
        "events_deleted": events_result.rowcount,
        "costs_deleted": costs_result.rowcount,
    }

    await logger.ainfo(
        "cleanup_completed",
        retention_days=retention_days,
        cutoff=cutoff.isoformat(),
        **deleted,
    )

    return deleted
