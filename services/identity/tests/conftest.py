"""Shared fixtures for Identity service tests."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.identity.repositories.system_key_repository import SystemAPIKey
from src.identity.routes.auth import router as auth_router
from src.identity.routes.users import router as users_router

# ---------------------------------------------------------------------------
# DB integration helpers
# ---------------------------------------------------------------------------

requires_db = pytest.mark.skipif(
    os.getenv("DATABASE_URL") is None,
    reason="Requires running PostgreSQL (set DATABASE_URL)",
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncSession:
    """Real AsyncSession backed by PostgreSQL. Truncates system_api_keys before and after.

    Tests must carry the requires_db marker so this fixture is never called without
    DATABASE_URL set. The table is created (checkfirst=True) on first use — no Alembic
    required for the standalone system_api_keys table.
    """
    # Ensure encryption key is available before any encrypt/decrypt call.
    if "ORION_ENCRYPTION_KEY" not in os.environ:
        from cryptography.fernet import Fernet  # noqa: PLC0415

        os.environ["ORION_ENCRYPTION_KEY"] = Fernet.generate_key().decode()

    url = os.environ["DATABASE_URL"]
    engine = create_async_engine(url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SystemAPIKey.__table__.create, checkfirst=True)
        await conn.execute(SystemAPIKey.__table__.delete())  # clean slate

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()

    async with engine.begin() as conn:
        await conn.execute(SystemAPIKey.__table__.delete())  # teardown

    await engine.dispose()


@pytest.fixture
def mock_session() -> AsyncMock:
    """Create a mock async database session."""
    session = AsyncMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def sample_user() -> MagicMock:
    """Return a mock User object with realistic attributes."""
    user = MagicMock()
    user.id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    user.email = "test@example.com"
    user.name = "Test User"
    user.first_name = None
    user.last_name = None
    user.role = "editor"
    user.avatar_url = None
    user.bio = None
    user.timezone = "UTC"
    user.email_verified = False
    user.is_active = True
    user.password_hash = "$2b$12$fakehashvalue"
    user.last_login_at = None
    user.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    user.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    return user


@pytest.fixture
def identity_app(mock_session: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with identity routers mounted."""
    app = FastAPI(title="Identity Test")
    app.include_router(auth_router, prefix="/internal")
    app.include_router(users_router)
    return app


@pytest_asyncio.fixture
async def client(identity_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=identity_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
