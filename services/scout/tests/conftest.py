"""Shared fixtures for Scout service tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.providers.base import TrendProvider, TrendResult
from src.routes.trends import router as trends_router


class FakeTrendProvider(TrendProvider):
    """Deterministic trend provider for testing."""

    def __init__(self, trends: list[TrendResult] | None = None) -> None:
        self._trends = trends or []

    async def fetch_trends(self, region: str = "US", limit: int = 20) -> list[TrendResult]:
        return self._trends[:limit]


@pytest.fixture
def sample_trends() -> list[TrendResult]:
    return [
        TrendResult(topic="AI coding assistants", score=85.0, source="rss"),
        TrendResult(topic="New GPU release", score=72.5, source="google_trends"),
        TrendResult(topic="Celebrity gossip news", score=60.0, source="twitter"),
        TrendResult(topic="Machine learning breakthrough", score=90.0, source="rss"),
        TrendResult(topic="Open source framework launch", score=55.0, source="rss"),
    ]


@pytest.fixture
def fake_provider(sample_trends: list[TrendResult]) -> FakeTrendProvider:
    return FakeTrendProvider(sample_trends)


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.publish = AsyncMock()
    bus.start_listening = AsyncMock()
    bus.close = AsyncMock()
    return bus


@pytest.fixture
def scout_app(fake_provider: FakeTrendProvider, mock_event_bus: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with the trends router mounted."""
    app = FastAPI(title="Scout Test")
    app.include_router(trends_router)
    app.state.providers = [fake_provider]
    app.state.event_bus = mock_event_bus
    app.state.active_niche = "tech"
    return app


@pytest_asyncio.fixture
async def client(scout_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=scout_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
