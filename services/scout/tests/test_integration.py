"""Scout service integration tests (A1-A4).

Uses real PostgreSQL and Redis containers via testcontainers.
The module-level engine injection ensures both route Depends AND
scheduler's direct `async for session in get_session()` calls hit
the same test database.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import orion_common.db.session as db_session_module
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import Base, Trend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from src.filters.niche_filter import DEFAULT_NICHE_CONFIGS, NicheFilter
from src.providers.base import TrendProvider, TrendResult
from src.routes.trends import router as trends_router
from src.scheduler import fetch_and_process_trends
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

pytestmark = pytest.mark.integration


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
    """Replace the global engine with a testcontainer-backed one.

    This makes both route Depends(get_session) AND scheduler's direct
    `async for session in get_session()` use the test database.
    """
    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _setup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_setup())

    # Inject into module globals so get_session() uses test DB
    db_session_module._engine = engine
    db_session_module._session_factory = factory

    yield engine

    async def _teardown() -> None:
        await engine.dispose()

    asyncio.run(_teardown())

    # Restore to None so other test modules don't inherit state
    db_session_module._engine = None
    db_session_module._session_factory = None


@pytest.fixture(autouse=True)
async def truncate_trends(inject_test_engine):
    """Wipe the trends table before each test for isolation."""
    async with inject_test_engine.begin() as conn:
        await conn.execute(Trend.__table__.delete())


# ---------------------------------------------------------------------------
# App and client fixtures
# ---------------------------------------------------------------------------


class FakeTrendProvider(TrendProvider):
    def __init__(self, trends: list[TrendResult]) -> None:
        self._trends = trends

    async def fetch_trends(self, region: str = "US", limit: int = 20) -> list[TrendResult]:
        return self._trends[:limit]


@pytest.fixture
def tech_trends() -> list[TrendResult]:
    return [
        TrendResult(topic="AI coding assistants", score=85.0, source="rss"),
        TrendResult(topic="New GPU release", score=72.5, source="google_trends"),
        TrendResult(topic="Machine learning breakthrough", score=90.0, source="rss"),
    ]


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.publish = AsyncMock()
    bus.start_listening = AsyncMock()
    bus.close = AsyncMock()
    return bus


@pytest.fixture
def scout_app(tech_trends: list[TrendResult], mock_event_bus: AsyncMock) -> FastAPI:
    app = FastAPI(title="Scout Integration Test")
    app.include_router(trends_router)
    app.state.providers = [FakeTrendProvider(tech_trends)]
    app.state.event_bus = mock_event_bus
    app.state.active_niche = "tech"
    return app


@pytest_asyncio.fixture
async def client(scout_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=scout_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# A1: scan stores trends to DB
# ---------------------------------------------------------------------------


async def test_a1_scan_stores_trends_to_db(client: AsyncClient, inject_test_engine) -> None:
    resp = await client.post("/api/v1/trends/scan", json={"niche": "tech"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["trends_saved"] >= 1

    async with inject_test_engine.connect() as conn:
        result = await conn.execute(select(Trend))
        rows = result.fetchall()

    assert len(rows) >= 1
    topics = {r.topic for r in rows}
    # Tech trends from provider pass the tech niche filter
    assert any("AI" in t or "GPU" in t or "Machine" in t for t in topics)


# ---------------------------------------------------------------------------
# A2: deduplication — second scan with same topics saves nothing
# ---------------------------------------------------------------------------


async def test_a2_deduplication_prevents_duplicate_trends(
    client: AsyncClient, inject_test_engine
) -> None:
    resp1 = await client.post("/api/v1/trends/scan", json={"niche": "tech"})
    assert resp1.status_code == 200
    first_saved = resp1.json()["trends_saved"]
    assert first_saved >= 1

    resp2 = await client.post("/api/v1/trends/scan", json={"niche": "tech"})
    assert resp2.status_code == 200
    assert resp2.json()["trends_saved"] == 0


# ---------------------------------------------------------------------------
# A3: GET /api/v1/trends returns trends persisted by scan
# ---------------------------------------------------------------------------


async def test_a3_list_trends_returns_db_rows(client: AsyncClient) -> None:
    scan_resp = await client.post("/api/v1/trends/scan", json={"niche": "tech"})
    assert scan_resp.status_code == 200

    list_resp = await client.get("/api/v1/trends")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


# ---------------------------------------------------------------------------
# A4: scan publishes TREND_DETECTED via EventBus
# ---------------------------------------------------------------------------


async def test_a4_scan_publishes_trend_detected_event(
    tech_trends: list[TrendResult], mock_event_bus: AsyncMock
) -> None:
    niche_filter = NicheFilter()
    niche_config = DEFAULT_NICHE_CONFIGS["tech"]

    total, saved = await fetch_and_process_trends(
        providers=[FakeTrendProvider(tech_trends)],
        niche_filter=niche_filter,
        niche_config=niche_config,
        event_bus=mock_event_bus,
    )

    assert saved >= 1
    assert mock_event_bus.publish.called
    call_args = mock_event_bus.publish.call_args_list
    channels = [c.args[0] for c in call_args]
    from orion_common.events import Channels

    assert Channels.TREND_DETECTED in channels
