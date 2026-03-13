"""Shared fixtures for Pulse service tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.routes import analytics, costs, pipeline
from src.services.event_aggregator import EventAggregator


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.subscribe = AsyncMock()
    bus.start_listening = AsyncMock()
    bus.close = AsyncMock()
    return bus


@pytest.fixture
def mock_session_factory() -> MagicMock:
    factory = MagicMock()
    session = AsyncMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=session)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return factory


@pytest.fixture
def mock_aggregator(
    mock_event_bus: AsyncMock, mock_session_factory: MagicMock
) -> EventAggregator:
    return EventAggregator(mock_event_bus, mock_session_factory)


@pytest.fixture
def pulse_app(mock_aggregator: EventAggregator) -> FastAPI:
    """Minimal FastAPI app with pulse routes."""
    app = FastAPI(title="Pulse Test")
    analytics.set_aggregator(mock_aggregator)
    app.include_router(analytics.router)
    app.include_router(costs.router)
    app.include_router(pipeline.router)
    return app


@pytest.fixture
async def client(pulse_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=pulse_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
