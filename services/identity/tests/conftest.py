"""Shared fixtures for Identity service tests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.identity.routes.auth import router as auth_router
from src.identity.routes.users import router as users_router


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
