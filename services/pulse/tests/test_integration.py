"""Pulse service integration tests (F1-F3).

F1: CostRepository.create() persists a ProviderCost row to real PostgreSQL.
F2: GET /api/v1/costs aggregates DB rows and returns the correct JSON totals.
F3: CostTracker receives a MEDIA_GENERATED event from real Redis and writes
    a ProviderCost row to the database.

The pulse-local ORM models (ProviderCost, AnalyticsEvent) extend the same
orion_common Base, so they must be imported before Base.metadata.create_all
so SQLAlchemy registers their tables.
"""

from __future__ import annotations

import asyncio

import orion_common.db.session as db_session_module
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import Base
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Import pulse-local ORM models BEFORE create_all so their tables are registered
from src.repositories.cost_repo import CostRepository, ProviderCost  # noqa: F401
from src.repositories.event_repo import AnalyticsEvent  # noqa: F401
from src.routes import analytics, costs, pipeline
from src.services.event_aggregator import EventAggregator
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

pytestmark = pytest.mark.integration

_ADMIN_HEADERS = {
    "X-User-ID": "00000000-0000-0000-0000-000000000001",
    "X-User-Role": "admin",
    "X-User-Email": "admin@orion.test",
}


# ---------------------------------------------------------------------------
# Session-scoped infrastructure
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:17") as pg:
        yield pg


@pytest.fixture(scope="session")
def redis_container():
    with RedisContainer("redis:7.4") as redis:
        yield redis


@pytest.fixture(scope="session")
def db_url(postgres_container: PostgresContainer) -> str:
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture(scope="session")
def redis_url_value(redis_container: RedisContainer) -> str:
    host = redis_container.get_container_host_ip()
    port = redis_container.get_exposed_port(6379)
    return f"redis://{host}:{port}"


@pytest.fixture(scope="session", autouse=True)
def inject_test_engine(db_url: str):
    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _setup() -> None:
        async with engine.begin() as conn:
            # All tables: orion_common models + pulse-local ProviderCost + AnalyticsEvent
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_setup())

    db_session_module._engine = engine
    db_session_module._session_factory = factory

    yield engine

    asyncio.run(engine.dispose())
    db_session_module._engine = None
    db_session_module._session_factory = None


@pytest.fixture(autouse=True)
async def clean_tables(inject_test_engine):
    async with inject_test_engine.begin() as conn:
        await conn.execute(ProviderCost.__table__.delete())
        await conn.execute(AnalyticsEvent.__table__.delete())


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def pulse_app() -> FastAPI:
    from unittest.mock import AsyncMock, MagicMock

    mock_event_bus = AsyncMock()
    mock_event_bus.subscribe = AsyncMock()
    mock_event_bus.start_listening = AsyncMock()
    mock_event_bus.close = AsyncMock()

    mock_sf = MagicMock()
    session = AsyncMock()
    mock_sf.return_value.__aenter__ = AsyncMock(return_value=session)
    mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

    aggregator = EventAggregator(mock_event_bus, mock_sf)

    app = FastAPI(title="Pulse Integration Test")
    analytics.set_aggregator(aggregator)
    app.include_router(analytics.router)
    app.include_router(costs.router)
    app.include_router(pipeline.router)
    return app


@pytest_asyncio.fixture
async def client(pulse_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=pulse_app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers=_ADMIN_HEADERS
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# F1: CostRepository.create() persists a row to real PostgreSQL
# ---------------------------------------------------------------------------


async def test_f1_cost_repository_persists_to_db(inject_test_engine) -> None:
    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        repo = CostRepository(session)
        record = await repo.create(
            provider="comfyui",
            category="image",
            amount=0.012,
            units=1.0,
            metadata={"model": "sdxl"},
        )

    assert record.id is not None
    assert record.provider == "comfyui"
    assert record.amount == pytest.approx(0.012)

    # Verify it's actually in the DB via a fresh session
    async with factory() as session:
        fetched = await session.get(ProviderCost, record.id)

    assert fetched is not None
    assert fetched.category == "image"


# ---------------------------------------------------------------------------
# F2: GET /api/v1/costs aggregates correctly
# ---------------------------------------------------------------------------


async def test_f2_get_costs_aggregates_db_rows(client: AsyncClient, inject_test_engine) -> None:
    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        repo = CostRepository(session)
        await repo.create(provider="comfyui", category="image", amount=0.05, units=1.0)
        await repo.create(provider="ollama", category="text", amount=0.02, units=1.0)
        await repo.create(provider="comfyui", category="image", amount=0.05, units=1.0)

    resp = await client.get("/api/v1/costs")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_cost"] == pytest.approx(0.12, abs=1e-4)
    assert data["record_count"] == 3
    assert "image" in data["by_category"]
    assert "text" in data["by_category"]
    assert data["by_category"]["image"] == pytest.approx(0.10, abs=1e-4)


# ---------------------------------------------------------------------------
# F3: CostTracker writes ProviderCost row when MEDIA_GENERATED event arrives
# ---------------------------------------------------------------------------


async def test_f3_cost_tracker_stores_cost_from_redis_event(
    inject_test_engine, redis_url_value: str
) -> None:
    from orion_common.event_bus import EventBus
    from orion_common.events import Channels
    from src.services.cost_tracker import CostTracker

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    event_bus = EventBus(redis_url_value)

    tracker = CostTracker(event_bus=event_bus, session_factory=factory)
    await tracker.start()
    await event_bus.start_listening()

    # Brief settle time for the subscriber to register
    await asyncio.sleep(0.1)

    # CostTracker._handle_cost_event expects "cost" as a nested dict;
    # "_channel" is used internally to infer the cost category.
    await event_bus.publish(
        Channels.MEDIA_GENERATED,
        {
            "_channel": Channels.MEDIA_GENERATED,
            "provider": "comfyui",
            "cost": {"units": 1.0, "rate": 0.02, "media_type": "image"},
        },
    )

    # Poll until CostRepository has written the row (up to 5 s)
    try:
        await asyncio.wait_for(_wait_for_cost_row(factory), timeout=5.0)
    finally:
        await event_bus.close()


async def _wait_for_cost_row(factory: async_sessionmaker, poll_interval: float = 0.1) -> None:
    """Poll until at least one ProviderCost row appears."""
    from sqlalchemy import select

    while True:
        async with factory() as session:
            result = await session.execute(select(ProviderCost))
            rows = result.scalars().all()
        if rows:
            return
        await asyncio.sleep(poll_interval)
