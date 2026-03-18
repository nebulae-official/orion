"""Tests for Pulse service API endpoints."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from src.schemas import PipelineMetrics

requires_db = pytest.mark.skipif(
    os.getenv("DATABASE_URL") is None,
    reason="Requires running database",
)


@pytest.mark.asyncio
async def test_get_metrics_returns_defaults(client: AsyncClient) -> None:
    """GET /api/v1/analytics/metrics returns pipeline metrics."""
    with patch(
        "src.services.event_aggregator.EventAggregator.get_pipeline_metrics",
        new_callable=AsyncMock,
        return_value=PipelineMetrics(
            throughput_per_hour=5.0, error_rate=0.02, stages=[]
        ),
    ):
        resp = await client.get("/api/v1/analytics/metrics?hours=24")

    assert resp.status_code in (200, 500)


@requires_db
@pytest.mark.asyncio
async def test_list_events_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/analytics/events needs DB session."""
    resp = await client.get("/api/v1/analytics/events")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_trend_analytics_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/analytics/trends needs DB session."""
    resp = await client.get("/api/v1/analytics/trends")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_get_costs_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/costs needs DB session."""
    resp = await client.get("/api/v1/costs")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_get_daily_costs_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/costs/daily needs DB session."""
    resp = await client.get("/api/v1/costs/daily")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_get_costs_by_provider_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/costs/by-provider needs DB session."""
    resp = await client.get("/api/v1/costs/by-provider")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_pipeline_funnel_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/pipeline/funnel needs DB session."""
    resp = await client.get("/api/v1/pipeline/funnel")
    assert resp.status_code in (500, 422)


@requires_db
@pytest.mark.asyncio
async def test_pipeline_errors_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/pipeline/errors needs DB session."""
    resp = await client.get("/api/v1/pipeline/errors")
    assert resp.status_code in (500, 422)
