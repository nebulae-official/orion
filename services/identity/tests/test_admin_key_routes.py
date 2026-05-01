"""Tests for admin system API key management routes (ORION-248)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.admin_keys import router as admin_keys_router

ADMIN_HEADERS = {
    "X-User-ID": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "X-User-Role": "admin",
    "X-User-Email": "admin@example.com",
}

EDITOR_HEADERS = {
    "X-User-ID": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "X-User-Role": "editor",
    "X-User-Email": "editor@example.com",
}


@pytest.fixture
def mock_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def admin_app(mock_repo: AsyncMock) -> FastAPI:
    app = FastAPI(title="Admin Keys Test")
    app.include_router(admin_keys_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(admin_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=admin_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_admin_keys_as_admin(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/admin/keys returns provider status list for admins."""
    mock_repo.list_providers.return_value = [
        {"provider": "nvidia_nim", "is_configured": True},
    ]

    with patch(
        "src.identity.routes.admin_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/admin/keys", headers=ADMIN_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert "keys" in data
    for item in data["keys"]:
        assert "encrypted_key" not in item
        assert "api_key" not in item


@pytest.mark.asyncio
async def test_list_admin_keys_forbidden_for_editor(client: AsyncClient) -> None:
    """GET /api/v1/admin/keys returns 403 for non-admin users."""
    resp = await client.get("/api/v1/admin/keys", headers=EDITOR_HEADERS)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_upsert_admin_key_as_admin(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """PUT /api/v1/admin/keys/{provider} stores a key for admins."""
    with patch(
        "src.identity.routes.admin_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.put(
            "/api/v1/admin/keys/nvidia_nim",
            json={"key": "nvapi-secret"},
            headers=ADMIN_HEADERS,
        )

    assert resp.status_code == 200
    mock_repo.upsert.assert_awaited_once_with("nvidia_nim", "nvapi-secret")


@pytest.mark.asyncio
async def test_upsert_admin_key_invalid_provider(client: AsyncClient) -> None:
    """PUT with unknown provider returns 400."""
    resp = await client.put(
        "/api/v1/admin/keys/unknown_provider",
        json={"key": "some-key"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upsert_admin_key_forbidden_for_editor(client: AsyncClient) -> None:
    """PUT /api/v1/admin/keys/{provider} returns 403 for non-admin users."""
    resp = await client.put(
        "/api/v1/admin/keys/nvidia_nim",
        json={"key": "nvapi-secret"},
        headers=EDITOR_HEADERS,
    )
    assert resp.status_code == 403
