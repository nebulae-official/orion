"""Tests for internal system key fetch route (ORION-248)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.internal_keys import router as internal_keys_router


@pytest.fixture
def mock_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def internal_app(mock_repo: AsyncMock) -> FastAPI:
    app = FastAPI(title="Internal Keys Test")
    app.include_router(internal_keys_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(internal_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=internal_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_get_system_key_found(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/internal/system-keys/{provider} returns key when configured."""
    mock_repo.get.return_value = "nvapi-decrypted-secret"

    with patch(
        "src.identity.routes.internal_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/internal/system-keys/nvidia_nim")

    assert resp.status_code == 200
    data = resp.json()
    assert data["key"] == "nvapi-decrypted-secret"
    mock_repo.get.assert_awaited_once_with("nvidia_nim")


@pytest.mark.asyncio
async def test_get_system_key_not_found(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/internal/system-keys/{provider} returns 404 when not configured."""
    mock_repo.get.return_value = None

    with patch(
        "src.identity.routes.internal_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/internal/system-keys/nvidia_nim")

    assert resp.status_code == 404
