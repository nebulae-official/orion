"""Trend API endpoints for the Scout service."""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.session import get_session
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from src.filters.niche_filter import DEFAULT_NICHE_CONFIGS, NicheConfig, NicheFilter
from src.providers.base import TrendProvider
from src.repositories.trend_repo import TrendRepository
from src.scheduler import fetch_and_process_trends
from src.schemas import (
    NicheConfigResponse,
    ScanResultResponse,
    TrendListResponse,
    TrendResponse,
    TriggerScanRequest,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/trends", tags=["trends"])

# These are set by main.py during app startup
_providers: list[TrendProvider] = []
_event_bus: EventBus | None = None
_active_niche: str | None = "tech"


def configure_routes(
    providers: list[TrendProvider],
    event_bus: EventBus,
    active_niche: str | None = "tech",
) -> None:
    """Wire runtime dependencies into the trends router.

    Called once during application startup from main.py lifespan.
    """
    global _providers, _event_bus, _active_niche  # noqa: PLW0603
    _providers = providers
    _event_bus = event_bus
    _active_niche = active_niche


@router.get("", response_model=TrendListResponse)
async def list_trends(
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> TrendListResponse:
    """List active trends with pagination."""
    repo = TrendRepository(session)
    trends, total = await repo.get_active(page=page, page_size=page_size)

    return TrendListResponse(
        items=[TrendResponse.model_validate(t) for t in trends],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/config", response_model=NicheConfigResponse)
async def get_niche_config() -> NicheConfigResponse:
    """Get the current active niche configuration."""
    config = DEFAULT_NICHE_CONFIGS.get(_active_niche or "tech")
    return NicheConfigResponse(
        active_niche=_active_niche,
        available_niches=list(DEFAULT_NICHE_CONFIGS.keys()),
        config=config,
    )


@router.get("/{trend_id}", response_model=TrendResponse)
async def get_trend(
    trend_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrendResponse:
    """Get a single trend by ID."""
    repo = TrendRepository(session)
    trend = await repo.get_by_id(trend_id)

    if trend is None:
        raise HTTPException(status_code=404, detail="Trend not found")

    return TrendResponse.model_validate(trend)


@router.post("/scan", response_model=ScanResultResponse)
async def trigger_scan(
    request: TriggerScanRequest,
) -> ScanResultResponse:
    """Trigger a manual trend scan.

    Runs the full ingestion pipeline on-demand: fetch from all
    providers, apply niche filter, deduplicate, persist, and publish.
    """
    if _event_bus is None:
        raise HTTPException(
            status_code=503,
            detail="Event bus not initialized",
        )

    niche_name = request.niche or _active_niche or "tech"
    niche_config = DEFAULT_NICHE_CONFIGS.get(niche_name)
    if niche_config is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown niche: {niche_name}. Available: {list(DEFAULT_NICHE_CONFIGS.keys())}",
        )

    niche_filter = NicheFilter()

    total_found, saved = await fetch_and_process_trends(
        providers=_providers,
        niche_filter=niche_filter,
        niche_config=niche_config,
        event_bus=_event_bus,
        region=request.region,
        limit=request.limit,
    )

    return ScanResultResponse(
        message=f"Scan complete using niche '{niche_name}'",
        trends_found=total_found,
        trends_saved=saved,
    )
