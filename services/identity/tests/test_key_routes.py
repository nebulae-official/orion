"""Integration tests for the encrypted API key routes (ORION-175)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.keys import router as keys_router

USER_ID = "11111111-1111-1111-1111-111111111111"
USER_HEADERS = {
    "X-User-ID": USER_ID,
    "X-User-Role": "editor",
    "X-User-Email": "test@example.com",
}

NOW = datetime(2026, 3, 20, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def mock_key_repo() -> AsyncMock:
    """Shared mock KeyRepository for all route tests."""
    return AsyncMock()


@pytest.fixture
def keys_app(mock_key_repo: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with the keys router mounted."""
    app = FastAPI(title="Keys Test")
    app.include_router(keys_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(keys_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=keys_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# POST /api/v1/keys/{provider}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_key_success(
    client: AsyncClient,
    mock_key_repo: AsyncMock,
) -> None:
    """POST /{provider} with a valid provider returns 201."""
    with patch(
        "src.identity.routes.keys.KeyRepository",
        return_value=mock_key_repo,
    ):
        resp = await client.post(
            "/api/v1/keys/openai",
            json={"api_key": "sk-test-key-123"},
            headers=USER_HEADERS,
        )

    assert resp.status_code == 201
    data = resp.json()
    assert "openai" in data["message"]
    mock_key_repo.upsert.assert_awaited_once_with(
        uuid.UUID(USER_ID),
        "openai",
        "sk-test-key-123",
    )


@pytest.mark.asyncio
async def test_store_key_invalid_provider(client: AsyncClient) -> None:
    """POST /{provider} with an unknown provider returns 400."""
    resp = await client.post(
        "/api/v1/keys/unknown_provider",
        json={"api_key": "sk-test-key"},
        headers=USER_HEADERS,
    )

    assert resp.status_code == 400
    assert "Unknown provider" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /api/v1/keys
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_keys_returns_metadata(
    client: AsyncClient,
    mock_key_repo: AsyncMock,
) -> None:
    """GET /api/v1/keys returns metadata list without secrets."""
    mock_key_repo.list_providers.return_value = [
        {
            "provider": "openai",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
        },
        {
            "provider": "anthropic",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
        },
    ]

    with patch(
        "src.identity.routes.keys.KeyRepository",
        return_value=mock_key_repo,
    ):
        resp = await client.get("/api/v1/keys", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["keys"]) == 2
    providers = [k["provider"] for k in data["keys"]]
    assert "openai" in providers
    assert "anthropic" in providers
    # Ensure no secret data is leaked
    for key_meta in data["keys"]:
        assert "api_key" not in key_meta
        assert "encrypted_key" not in key_meta


# ---------------------------------------------------------------------------
# DELETE /api/v1/keys/{provider}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_key_success(
    client: AsyncClient,
    mock_key_repo: AsyncMock,
) -> None:
    """DELETE /{provider} returns 200 when a key exists."""
    mock_key_repo.delete.return_value = True

    with patch(
        "src.identity.routes.keys.KeyRepository",
        return_value=mock_key_repo,
    ):
        resp = await client.delete("/api/v1/keys/openai", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"]
    mock_key_repo.delete.assert_awaited_once_with(uuid.UUID(USER_ID), "openai")


@pytest.mark.asyncio
async def test_delete_key_not_found(
    client: AsyncClient,
    mock_key_repo: AsyncMock,
) -> None:
    """DELETE /{provider} returns 404 when the key does not exist."""
    mock_key_repo.delete.return_value = False

    with patch(
        "src.identity.routes.keys.KeyRepository",
        return_value=mock_key_repo,
    ):
        resp = await client.delete("/api/v1/keys/openai", headers=USER_HEADERS)

    assert resp.status_code == 404
    assert "No key found" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Auth requirement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_key_requires_auth(client: AsyncClient) -> None:
    """POST /{provider} without X-User-ID returns 401."""
    resp = await client.post(
        "/api/v1/keys/openai",
        json={"api_key": "sk-test-key"},
        # No user headers
    )

    assert resp.status_code == 401
    assert "Missing user context" in resp.json()["detail"]
