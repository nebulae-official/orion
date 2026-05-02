"""Integration tests for catalog discovery route and provider override (ORION-258).

Tests run the full FastAPI stack.  No external provider calls are made.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient

from .conftest import INTERNAL_HEADERS

# ---------------------------------------------------------------------------
# E. Catalog route — GET /api/v1/providers
# ---------------------------------------------------------------------------


async def test_catalog_returns_three_entries(client: AsyncClient) -> None:
    """E1 — catalog endpoint returns all three capability entries."""
    resp = await client.get("/api/v1/providers", headers=INTERNAL_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3
    capabilities = {e["capability"] for e in data}
    assert capabilities == {"llm", "image", "tts"}


async def test_catalog_all_entries_are_nvidia_nim(client: AsyncClient) -> None:
    """E2 — all catalog entries in Phase 1 belong to nvidia_nim provider."""
    resp = await client.get("/api/v1/providers", headers=INTERNAL_HEADERS)

    assert resp.status_code == 200
    for entry in resp.json():
        assert entry["provider"] == "nvidia_nim"


async def test_catalog_entries_have_no_secrets(client: AsyncClient) -> None:
    """E3 — no API keys or secret values appear in catalog response."""
    resp = await client.get("/api/v1/providers", headers=INTERNAL_HEADERS)

    assert resp.status_code == 200
    raw = resp.text
    # nvapi- prefix is the NVIDIA API key format; must never appear in catalog output
    assert "nvapi-" not in raw


async def test_catalog_entry_shape(client: AsyncClient) -> None:
    """E4 — each catalog entry contains required fields."""
    resp = await client.get("/api/v1/providers", headers=INTERNAL_HEADERS)

    assert resp.status_code == 200
    for entry in resp.json():
        assert "provider" in entry
        assert "capability" in entry
        assert "credential_kind" in entry
        assert "default_model" in entry
        assert "base_url" in entry


async def test_catalog_blocked_without_internal_token(client: AsyncClient) -> None:
    """E5 — InternalAuthMiddleware rejects catalog requests with no X-Internal-Token."""
    resp = await client.get("/api/v1/providers")

    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# F. Provider override — optional `provider` field on request bodies
# ---------------------------------------------------------------------------


def _llm_mock_response(
    content: str = "ok", model: str = "meta/llama-3.3-70b-instruct"
) -> MagicMock:
    resp = MagicMock()
    resp.choices[0].message.content = content
    resp.model = model
    resp.usage = None
    return resp


async def test_llm_explicit_nvidia_nim_provider_same_behavior(client: AsyncClient) -> None:
    """F1 — explicitly passing provider=nvidia_nim behaves identically to omitting it."""
    mock_resp = _llm_mock_response("Hello from NVIDIA")

    with patch("litellm.acompletion", new=AsyncMock(return_value=mock_resp)):
        resp = await client.post(
            "/api/v1/llm/complete",
            json={"prompt": "Say hello", "provider": "nvidia_nim"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    assert resp.json()["content"] == "Hello from NVIDIA"


async def test_llm_unknown_provider_returns_422(client: AsyncClient) -> None:
    """F2 — requesting an unregistered provider returns 422 Unprocessable Entity."""
    resp = await client.post(
        "/api/v1/llm/complete",
        json={"prompt": "hello", "provider": "does_not_exist"},
        headers=INTERNAL_HEADERS,
    )

    assert resp.status_code == 422
    assert "does_not_exist" in resp.json()["detail"]


async def test_image_explicit_nvidia_nim_provider(client: AsyncClient) -> None:
    """F3 — image route accepts explicit provider=nvidia_nim and routes correctly."""

    @asynccontextmanager
    async def _mock_httpx(*args, **kwargs):  # noqa: ARG001
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"artifacts": [{"base64": "aGVsbG8=", "seed": 1}]}
        mock_client.post = AsyncMock(return_value=mock_resp)
        yield mock_client

    with patch("httpx.AsyncClient", _mock_httpx):
        resp = await client.post(
            "/api/v1/image/generate",
            json={"prompt": "a landscape", "provider": "nvidia_nim"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    assert "nvidia_nim" in resp.json()["provider"]


async def test_tts_explicit_nvidia_nim_provider(client: AsyncClient) -> None:
    """F4 — TTS route accepts explicit provider=nvidia_nim and routes correctly."""

    @asynccontextmanager
    async def _mock_httpx(*args, **kwargs):  # noqa: ARG001
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = b"audio-bytes"
        mock_client.post = AsyncMock(return_value=mock_resp)
        yield mock_client

    with patch("httpx.AsyncClient", _mock_httpx):
        resp = await client.post(
            "/api/v1/tts/speak",
            json={"text": "Hello", "provider": "nvidia_nim"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    assert "nvidia_nim" in resp.json()["provider"]
