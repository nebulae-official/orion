"""Media service integration tests (C1-C3).

Uses real PostgreSQL via testcontainers. The module-level engine injection
ensures Depends(get_session) in image routes hits the test database.
Provider calls are handled by an in-memory FakeImageProvider.
"""

from __future__ import annotations

import asyncio
import uuid

import orion_common.db.session as db_session_module
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import (
    Base,
    Content,
    ContentStatus,
    MediaAsset,
    Trend,
    TrendStatus,
    User,
)
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from src.providers.base import ImageProvider, ImageRequest, ImageResult
from src.repositories.asset_repo import MediaAssetRepository
from src.routes.images import configure_router
from src.routes.images import router as images_router
from src.services.batch_generator import BatchGenerator
from testcontainers.postgres import PostgresContainer

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
    async with inject_test_engine.begin() as conn:
        await conn.execute(MediaAsset.__table__.delete())
        await conn.execute(Content.__table__.delete())
        await conn.execute(Trend.__table__.delete())
        await conn.execute(User.__table__.delete())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class FakeImageProvider(ImageProvider):
    def __init__(self) -> None:
        self._count = 0

    async def generate(self, request: ImageRequest) -> ImageResult:
        self._count += 1
        return ImageResult(
            file_path=f"/tmp/test_image_{self._count}.png",
            provider="fake",
            width=request.width,
            height=request.height,
            metadata={"prompt": request.prompt},
        )

    async def is_available(self) -> bool:
        return True


async def _seed_content(engine) -> tuple[User, Content]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = User(id=uuid.uuid4(), email="media@test.com", name="Media User", role="editor")
        session.add(user)
        await session.flush()

        trend = Trend(
            id=uuid.uuid4(),
            topic="AI image generation",
            source="rss",
            score=85.0,
            status=TrendStatus.active,
        )
        session.add(trend)
        await session.flush()

        content = Content(
            id=uuid.uuid4(),
            trend_id=trend.id,
            title="Test content for media",
            status=ContentStatus.generating,
            created_by=user.id,
        )
        session.add(content)
        await session.commit()
        await session.refresh(content)
        return user, content


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_provider() -> FakeImageProvider:
    return FakeImageProvider()


@pytest.fixture
def media_app(fake_provider: FakeImageProvider) -> FastAPI:
    app = FastAPI(title="Media Integration Test")
    app.include_router(images_router)
    batch_gen = BatchGenerator(fake_provider, max_concurrent=2)
    configure_router(fake_provider, batch_gen)
    return app


@pytest_asyncio.fixture
async def client(media_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=media_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# C1: generate stores MediaAsset in DB
# ---------------------------------------------------------------------------


async def test_c1_generate_stores_media_asset_in_db(
    client: AsyncClient, inject_test_engine
) -> None:
    _, content = await _seed_content(inject_test_engine)

    resp = await client.post(
        "/api/v1/media/generate",
        json={"prompt": "A futuristic city at night", "content_id": str(content.id)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["file_path"].endswith(".png")
    assert data["asset_id"] is not None

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        repo = MediaAssetRepository(session)
        assets = await repo.get_by_content_id(content.id)

    assert len(assets) == 1
    assert assets[0].provider == "fake"


# ---------------------------------------------------------------------------
# C2: batch generates and stores multiple MediaAssets
# ---------------------------------------------------------------------------


async def test_c2_batch_generate_stores_all_assets(client: AsyncClient, inject_test_engine) -> None:
    _, content = await _seed_content(inject_test_engine)

    resp = await client.post(
        "/api/v1/media/batch",
        json={
            "content_id": str(content.id),
            "prompts": [
                {"prompt": "Scene 1: office environment"},
                {"prompt": "Scene 2: city skyline"},
                {"prompt": "Scene 3: close-up portrait"},
            ],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["succeeded"] == 3
    assert data["failed_count"] == 0
    assert len(data["results"]) == 3

    factory = async_sessionmaker(inject_test_engine, expire_on_commit=False)
    async with factory() as session:
        repo = MediaAssetRepository(session)
        assets = await repo.get_by_content_id(content.id)

    assert len(assets) == 3


# ---------------------------------------------------------------------------
# C3: GET /api/v1/media/assets/{content_id} returns DB-persisted assets
# ---------------------------------------------------------------------------


async def test_c3_get_assets_returns_persisted_rows(
    client: AsyncClient, inject_test_engine
) -> None:
    _, content = await _seed_content(inject_test_engine)

    # Generate two images
    for prompt in ["Prompt A", "Prompt B"]:
        await client.post(
            "/api/v1/media/generate",
            json={"prompt": prompt, "content_id": str(content.id)},
        )

    resp = await client.get(f"/api/v1/media/assets/{content.id}")
    assert resp.status_code == 200
    assets = resp.json()
    assert len(assets) == 2
    assert all(a["content_id"] == str(content.id) for a in assets)
    assert all(a["asset_type"] == "image" for a in assets)
