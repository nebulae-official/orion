"""Tests for the provider preferences API endpoints (ORION-176)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.providers import router as providers_router

USER_ID = "11111111-1111-1111-1111-111111111111"
USER_HEADERS = {"X-User-ID": USER_ID, "X-User-Role": "editor"}


@pytest.fixture
def provider_app() -> FastAPI:
    """Create a minimal FastAPI app with provider routes mounted."""
    app = FastAPI(title="Provider Preferences Test")
    app.include_router(providers_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(provider_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=provider_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# GET /api/v1/settings/providers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_provider_preferences_defaults(client: AsyncClient) -> None:
    """GET /providers returns empty preferences when no settings exist."""
    with patch(
        "src.identity.routes.providers.user_repo.get_user_settings",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get("/api/v1/settings/providers", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    providers = data["providers"]
    assert providers["llm_provider"] is None
    assert providers["llm_model"] is None
    assert providers["image_provider"] is None
    assert providers["image_model"] is None
    assert providers["tts_provider"] is None
    assert providers["tts_voice_id"] is None


@pytest.mark.asyncio
async def test_get_provider_preferences_with_data(client: AsyncClient) -> None:
    """GET /providers returns existing provider preferences from settings."""
    settings_row = MagicMock()
    settings_row.settings = {
        "providers": {
            "llm_provider": "CLOUD",
            "llm_model": "gpt-4o",
            "image_provider": "fal_ai",
            "image_model": "flux-schnell",
        }
    }

    with patch(
        "src.identity.routes.providers.user_repo.get_user_settings",
        new_callable=AsyncMock,
        return_value=settings_row,
    ):
        resp = await client.get("/api/v1/settings/providers", headers=USER_HEADERS)

    assert resp.status_code == 200
    providers = resp.json()["providers"]
    assert providers["llm_provider"] == "CLOUD"
    assert providers["llm_model"] == "gpt-4o"
    assert providers["image_provider"] == "fal_ai"
    assert providers["image_model"] == "flux-schnell"
    assert providers["tts_provider"] is None
    assert providers["tts_voice_id"] is None


# ---------------------------------------------------------------------------
# PUT /api/v1/settings/providers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_provider_preferences(client: AsyncClient) -> None:
    """PUT /providers updates and returns merged provider preferences."""
    updated_settings = MagicMock()
    updated_settings.settings = {
        "providers": {
            "llm_provider": "CLOUD",
            "llm_model": "gpt-4o",
            "image_provider": "comfyui",
        }
    }

    with patch(
        "src.identity.routes.providers.user_repo.upsert_user_settings",
        new_callable=AsyncMock,
        return_value=updated_settings,
    ) as mock_upsert:
        resp = await client.put(
            "/api/v1/settings/providers",
            headers=USER_HEADERS,
            json={
                "llm_provider": "CLOUD",
                "llm_model": "gpt-4o",
                "image_provider": "comfyui",
            },
        )

    assert resp.status_code == 200
    providers = resp.json()["providers"]
    assert providers["llm_provider"] == "CLOUD"
    assert providers["llm_model"] == "gpt-4o"
    assert providers["image_provider"] == "comfyui"

    mock_upsert.assert_awaited_once()
    call_args = mock_upsert.call_args
    merged_payload = call_args[0][2]  # third positional arg: settings dict
    # Only non-None fields should be in the providers merge dict
    assert merged_payload == {
        "providers": {
            "llm_provider": "CLOUD",
            "llm_model": "gpt-4o",
            "image_provider": "comfyui",
        }
    }


@pytest.mark.asyncio
async def test_update_provider_preferences_partial(client: AsyncClient) -> None:
    """PUT /providers performs partial merge -- only non-None fields are sent."""
    updated_settings = MagicMock()
    updated_settings.settings = {
        "providers": {
            "llm_provider": "CLOUD",
            "llm_model": "gpt-4o",
            "tts_provider": "LOCAL",
        }
    }

    with patch(
        "src.identity.routes.providers.user_repo.upsert_user_settings",
        new_callable=AsyncMock,
        return_value=updated_settings,
    ) as mock_upsert:
        # Only send tts_provider; other fields are omitted (default None)
        resp = await client.put(
            "/api/v1/settings/providers",
            headers=USER_HEADERS,
            json={"tts_provider": "LOCAL"},
        )

    assert resp.status_code == 200
    providers = resp.json()["providers"]
    # The response reflects the full merged state from the repo
    assert providers["llm_provider"] == "CLOUD"
    assert providers["tts_provider"] == "LOCAL"

    mock_upsert.assert_awaited_once()
    call_args = mock_upsert.call_args
    merged_payload = call_args[0][2]
    # Only tts_provider should appear in the update dict (partial merge)
    assert merged_payload == {"providers": {"tts_provider": "LOCAL"}}


# ---------------------------------------------------------------------------
# Auth required (401)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_provider_preferences_requires_auth(client: AsyncClient) -> None:
    """GET /providers without X-User-ID header returns 401."""
    resp = await client.get("/api/v1/settings/providers")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_provider_preferences_requires_auth(client: AsyncClient) -> None:
    """PUT /providers without X-User-ID header returns 401."""
    resp = await client.put(
        "/api/v1/settings/providers",
        json={"llm_provider": "CLOUD"},
    )
    assert resp.status_code == 401
