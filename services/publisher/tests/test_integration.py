"""Publisher service integration tests (E1-E3).

Uses real PostgreSQL via testcontainers. TwitterProvider.publish is patched at
the SocialProvider boundary to avoid requiring tweepy's aiohttp optional extra.
The event bus is injected via dependency_overrides.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from cryptography.fernet import Fernet
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import (
    Base,
    Content,
    ContentStatus,
    PublishRecord,
    PublishStatus,
    SocialAccount,
    Trend,
    TrendStatus,
    User,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

import orion_common.db.session as db_session_module
from src.dependencies import get_event_bus
from src.providers.twitter import TwitterProvider
from src.routes.publish import router as publish_router
from src.schemas import PublishResult as _PublishResult
from src.services.crypto import encrypt_credentials

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Encryption key — must be set before any crypto module import resolves it
# ---------------------------------------------------------------------------

_FERNET_KEY = Fernet.generate_key().decode()


@pytest.fixture(scope="session", autouse=True)
def set_encryption_key():
    os.environ["ORION_ENCRYPTION_KEY"] = _FERNET_KEY
    yield
    del os.environ["ORION_ENCRYPTION_KEY"]


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
def inject_test_engine(db_url: str, set_encryption_key):
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
    async with inject_test_engine.begin() as conn:
        await conn.execute(PublishRecord.__table__.delete())
        await conn.execute(SocialAccount.__table__.delete())
        await conn.execute(Content.__table__.delete())
        await conn.execute(Trend.__table__.delete())
        await conn.execute(User.__table__.delete())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_publish_scenario(engine) -> tuple[User, Content, SocialAccount]:
    """Seed a user, approved content, and an active twitter social account."""
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = User(id=uuid.uuid4(), email="publisher@test.com", name="Publisher", role="editor")
        session.add(user)
        await session.flush()

        trend = Trend(
            id=uuid.uuid4(),
            topic="Publisher integration test topic",
            source="rss",
            score=80.0,
            status=TrendStatus.active,
        )
        session.add(trend)
        await session.flush()

        content = Content(
            id=uuid.uuid4(),
            trend_id=trend.id,
            title="Publisher integration test",
            script_body="This content body is long enough to pass the safety check.",
            status=ContentStatus.approved,
            created_by=user.id,
        )
        session.add(content)
        await session.flush()

        creds = encrypt_credentials(
            {
                "api_key": "fake_api_key",
                "api_secret": "fake_api_secret",
                "access_token": "fake_access_token",
                "access_token_secret": "fake_access_secret",
            }
        )
        account = SocialAccount(
            id=uuid.uuid4(),
            platform="twitter",
            display_name="@testaccount",
            credentials=creds,
            is_active=True,
            user_id=user.id,
        )
        session.add(account)
        await session.commit()
        await session.refresh(content)
        await session.refresh(account)
        return user, content, account


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def publisher_app(mock_event_bus: AsyncMock) -> FastAPI:
    app = FastAPI(title="Publisher Integration Test")
    app.include_router(publish_router)
    app.dependency_overrides[get_event_bus] = lambda: mock_event_bus
    return app


@pytest_asyncio.fixture
async def client(publisher_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=publisher_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# E1: publish_content creates a PublishRecord with status=published
# ---------------------------------------------------------------------------


async def test_e1_publish_creates_publish_record_in_db(client: AsyncClient, inject_test_engine) -> None:
    user, content, _ = await _seed_publish_scenario(inject_test_engine)

    ok = _PublishResult(platform="twitter", status="published", platform_post_id="tweet_123456")
    with patch.object(TwitterProvider, "publish", new_callable=AsyncMock, return_value=ok):
        resp = await client.post(
            "/api/v1/publish/",
            json={"content_id": str(content.id), "platforms": ["twitter"]},
            headers={"X-User-ID": str(user.id), "X-User-Role": "editor", "X-User-Email": user.email},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["status"] == "published"

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        result = await session.execute(select(PublishRecord).where(PublishRecord.content_id == content.id))
        records = result.scalars().all()

    assert len(records) == 1
    assert records[0].status == PublishStatus.published
    assert records[0].platform == "twitter"
    assert records[0].platform_post_id == "tweet_123456"


# ---------------------------------------------------------------------------
# E2: publish_content emits CONTENT_PUBLISHED event
# ---------------------------------------------------------------------------


async def test_e2_publish_emits_content_published_event(
    client: AsyncClient, inject_test_engine, mock_event_bus: AsyncMock
) -> None:
    user, content, _ = await _seed_publish_scenario(inject_test_engine)

    ok = _PublishResult(platform="twitter", status="published", platform_post_id="tweet_event_test")
    with patch.object(TwitterProvider, "publish", new_callable=AsyncMock, return_value=ok):
        resp = await client.post(
            "/api/v1/publish/",
            json={"content_id": str(content.id), "platforms": ["twitter"]},
            headers={"X-User-ID": str(user.id), "X-User-Role": "editor", "X-User-Email": user.email},
        )

    assert resp.status_code == 200

    from orion_common.events import Channels

    mock_event_bus.publish.assert_called_once()
    channel, payload = mock_event_bus.publish.call_args.args
    assert channel == Channels.CONTENT_PUBLISHED
    assert payload["content_id"] == str(content.id)
    assert "twitter" in payload["platforms"]


# ---------------------------------------------------------------------------
# E3: content.status updated to "published" in DB after successful publish
# ---------------------------------------------------------------------------


async def test_e3_content_status_set_to_published(client: AsyncClient, inject_test_engine) -> None:
    user, content, _ = await _seed_publish_scenario(inject_test_engine)

    ok = _PublishResult(platform="twitter", status="published", platform_post_id="tweet_status_test")
    with patch.object(TwitterProvider, "publish", new_callable=AsyncMock, return_value=ok):
        resp = await client.post(
            "/api/v1/publish/",
            json={"content_id": str(content.id), "platforms": ["twitter"]},
            headers={"X-User-ID": str(user.id), "X-User-Role": "editor", "X-User-Email": user.email},
        )

    assert resp.status_code == 200

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        refreshed = await session.get(Content, content.id)

    assert refreshed is not None
    assert refreshed.status == ContentStatus.published
