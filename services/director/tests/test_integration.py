"""Director service integration tests (B1-B3).

Uses real PostgreSQL via testcontainers. The module-level engine injection
ensures Depends(get_session) hits the test database. User context is supplied
via gateway-forwarded headers (X-User-ID, X-User-Role, X-User-Email).
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import Base, Content, ContentStatus, Trend, TrendStatus, User
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

import orion_common.db.session as db_session_module
from src.routes.content import router as content_router

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Session-scoped infrastructure
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:17") as pg:
        yield pg


@pytest.fixture(scope="session")
def db_url(postgres_container: PostgresContainer) -> str:
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture(scope="session", autouse=True)
def inject_test_engine(db_url: str):
    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _setup() -> None:
        async with engine.begin() as conn:
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
    """Truncate content-related tables before each test."""
    async with inject_test_engine.begin() as conn:
        await conn.execute(Content.__table__.delete())
        await conn.execute(Trend.__table__.delete())
        await conn.execute(User.__table__.delete())


# ---------------------------------------------------------------------------
# Helpers to seed DB rows
# ---------------------------------------------------------------------------


async def _make_user(engine, role: str = "editor") -> User:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = User(
            id=uuid.uuid4(),
            email=f"user-{uuid.uuid4()}@test.com",
            name="Test User",
            role=role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _make_content(engine, user: User, status: ContentStatus = ContentStatus.review) -> Content:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        trend = Trend(
            id=uuid.uuid4(),
            topic="AI integration test",
            source="rss",
            score=80.0,
            status=TrendStatus.active,
        )
        session.add(trend)
        await session.flush()

        content = Content(
            id=uuid.uuid4(),
            trend_id=trend.id,
            title="AI integration test content",
            script_body="This is a long enough body for safety checks.",
            status=status,
            created_by=user.id,
        )
        session.add(content)
        await session.commit()
        await session.refresh(content)
        return content


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def director_app(mock_event_bus: AsyncMock) -> FastAPI:
    app = FastAPI(title="Director Integration Test")
    app.include_router(content_router)
    app.state.event_bus = mock_event_bus
    return app


@pytest_asyncio.fixture
async def client(director_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=director_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# B1: reject stores status=rejected in DB
# ---------------------------------------------------------------------------


async def test_b1_reject_stores_rejected_status_in_db(client: AsyncClient, inject_test_engine) -> None:
    user = await _make_user(inject_test_engine)
    content = await _make_content(inject_test_engine, user)

    resp = await client.post(
        f"/api/v1/content/{content.id}/reject",
        json={"reason": "Does not meet quality standards"},
        headers={
            "X-User-ID": str(user.id),
            "X-User-Role": user.role,
            "X-User-Email": user.email,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        refreshed = await session.get(Content, content.id)

    assert refreshed is not None
    assert refreshed.status == ContentStatus.rejected


# ---------------------------------------------------------------------------
# B2: reject publishes CONTENT_REJECTED event
# ---------------------------------------------------------------------------


async def test_b2_reject_publishes_content_rejected_event(client: AsyncClient, inject_test_engine, mock_event_bus: AsyncMock) -> None:
    user = await _make_user(inject_test_engine)
    content = await _make_content(inject_test_engine, user)

    resp = await client.post(
        f"/api/v1/content/{content.id}/reject",
        json={"reason": "Tone is off brand"},
        headers={
            "X-User-ID": str(user.id),
            "X-User-Role": user.role,
            "X-User-Email": user.email,
        },
    )
    assert resp.status_code == 200

    from orion_common.events import Channels

    mock_event_bus.publish.assert_called_once()
    channel, payload = mock_event_bus.publish.call_args.args
    assert channel == Channels.CONTENT_REJECTED
    assert payload["content_id"] == str(content.id)


# ---------------------------------------------------------------------------
# B3: GET /api/v1/content enforces user isolation
# ---------------------------------------------------------------------------


async def test_b3_list_content_user_isolation(client: AsyncClient, inject_test_engine) -> None:
    user_a = await _make_user(inject_test_engine)
    user_b = await _make_user(inject_test_engine)
    admin = await _make_user(inject_test_engine, role="admin")

    content_a = await _make_content(inject_test_engine, user_a)
    await _make_content(inject_test_engine, user_b)

    # user_a sees only their own content
    resp_a = await client.get(
        "/api/v1/content",
        headers={"X-User-ID": str(user_a.id), "X-User-Role": "editor", "X-User-Email": user_a.email},
    )
    assert resp_a.status_code == 200
    ids_a = {item["id"] for item in resp_a.json()}
    assert str(content_a.id) in ids_a
    assert len(ids_a) == 1

    # user_b sees only their own content
    resp_b = await client.get(
        "/api/v1/content",
        headers={"X-User-ID": str(user_b.id), "X-User-Role": "editor", "X-User-Email": user_b.email},
    )
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 1
    assert resp_b.json()[0]["id"] != str(content_a.id)

    # admin sees all content
    resp_admin = await client.get(
        "/api/v1/content",
        headers={"X-User-ID": str(admin.id), "X-User-Role": "admin", "X-User-Email": admin.email},
    )
    assert resp_admin.status_code == 200
    assert len(resp_admin.json()) == 2
