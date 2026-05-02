"""Shared fixtures for Provider Service integration tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.health import create_health_router
from orion_common.middleware import InternalAuthMiddleware
from src.key_resolver import KeyResolver
from src.routes.catalog import router as catalog_router
from src.routes.image import router as image_router
from src.routes.llm import router as llm_router
from src.routes.tts import router as tts_router

INTERNAL_HEADERS = {"X-Internal-Token": "test-token"}


@pytest_asyncio.fixture
async def provider_app() -> FastAPI:
    """Full Provider FastAPI app with a mock KeyResolver backed by a mock IdentityClient.

    The mock identity returns "test-nvapi-key" for get_system_api_key and None for
    get_api_key (per-user key), so tests that need per-user key behaviour must
    override app.state.key_resolver before making the request.
    """
    mock_identity = AsyncMock()
    mock_identity.get_api_key = AsyncMock(return_value=None)
    mock_identity.get_system_api_key = AsyncMock(return_value="test-nvapi-key")

    app = FastAPI(title="Provider Integration Test")
    app.add_middleware(InternalAuthMiddleware, token="test-token")

    health_router = create_health_router("provider")
    app.include_router(health_router)
    app.include_router(catalog_router)
    app.include_router(llm_router)
    app.include_router(image_router)
    app.include_router(tts_router)

    app.state.key_resolver = KeyResolver(identity_client=mock_identity)

    yield app


@pytest_asyncio.fixture
async def client(provider_app: FastAPI) -> AsyncClient:
    """AsyncClient wired to the provider test app via ASGITransport."""
    transport = ASGITransport(app=provider_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
