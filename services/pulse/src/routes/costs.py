"""Cost tracking endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from orion_common.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.cost_repo import CostRepository
from src.schemas import (
    CostSummary,
    DailyCostSummary,
    ProviderCostSummary,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/costs", tags=["costs"])


@router.get("", response_model=CostSummary)
async def get_costs(
    session: Annotated[AsyncSession, Depends(get_session)],
    days: int = Query(default=30, ge=1, le=365, description="Cost window in days"),
) -> CostSummary:
    """Get total cost summary for the specified period."""
    repo = CostRepository(session)
    since = datetime.now(UTC) - timedelta(days=days)
    data = await repo.get_total_costs(since=since)
    return CostSummary(**data)


@router.get("/daily", response_model=list[DailyCostSummary])
async def get_daily_costs(
    session: Annotated[AsyncSession, Depends(get_session)],
    days: int = Query(default=30, ge=1, le=90, description="Number of days"),
) -> list[DailyCostSummary]:
    """Get daily cost breakdown."""
    repo = CostRepository(session)
    rows = await repo.get_daily_costs(days=days)
    return [DailyCostSummary(**row) for row in rows]


@router.get("/by-provider", response_model=list[ProviderCostSummary])
async def get_costs_by_provider(
    session: Annotated[AsyncSession, Depends(get_session)],
    days: int = Query(default=30, ge=1, le=365, description="Cost window in days"),
) -> list[ProviderCostSummary]:
    """Get costs grouped by provider."""
    repo = CostRepository(session)
    since = datetime.now(UTC) - timedelta(days=days)
    rows = await repo.get_costs_by_provider(since=since)
    return [
        ProviderCostSummary(
            provider=r["provider"],
            total_cost=r["total_cost"],
            by_category=r["by_category"],
        )
        for r in rows
    ]
