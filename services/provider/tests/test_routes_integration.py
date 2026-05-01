"""Integration tests for Provider Service routes (ORION-249).

Tests run the full FastAPI app stack. Only external HTTP calls to NVIDIA
APIs are mocked — the KeyResolver and app.state are real (or overridden
per-test via provider_app fixture mutation).
"""

from __future__ import annotations

import base64
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from httpx import AsyncClient
from src.key_resolver import KeyResolver, KeyUnavailableError

from .conftest import INTERNAL_HEADERS

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NVIDIA_LLM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
_NVIDIA_IMAGE_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell"
_NVIDIA_TTS_URL = "https://integrate.api.nvidia.com/v1/audio/speech"


def _llm_mock_response(content: str, model: str = "meta/llama-3.3-70b-instruct") -> MagicMock:
    """Build a minimal litellm response object."""
    resp = MagicMock()
    resp.choices[0].message.content = content
    resp.model = model
    resp.usage = None
    return resp


def _mock_httpx_client(
    json_resp: dict | None = None,
    content: bytes | None = None,
    raise_http_error: bool = False,
) -> object:
    """Return an async-context-manager factory that replaces httpx.AsyncClient.

    Patches only the internal client created inside route handlers; the
    ASGITransport-based test client is unaffected (it is a pre-existing instance).
    """
    mock_response = MagicMock()
    if raise_http_error:
        req = httpx.Request("POST", "https://ai.api.nvidia.com/")
        err_resp = httpx.Response(500, request=req)
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Server Error", request=req, response=err_resp
        )
    else:
        mock_response.raise_for_status = MagicMock()
    if json_resp is not None:
        mock_response.json.return_value = json_resp
    if content is not None:
        mock_response.content = content

    @asynccontextmanager
    async def _factory(*args: object, **kwargs: object):  # noqa: ARG001
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        yield mock_client

    return _factory


# ---------------------------------------------------------------------------
# A. LLM route — POST /api/v1/llm/complete
# ---------------------------------------------------------------------------


async def test_llm_complete_success(client: AsyncClient) -> None:
    """A1 — successful LLM completion returns 200 with NVIDIA response."""
    mock_resp = _llm_mock_response("Hello from NVIDIA")

    with patch("litellm.acompletion", new=AsyncMock(return_value=mock_resp)):
        resp = await client.post(
            "/api/v1/llm/complete",
            json={"prompt": "Say hello", "system_prompt": "You are helpful"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "Hello from NVIDIA"
    assert "llama" in data["model"]


async def test_llm_complete_503_no_key(provider_app, client: AsyncClient) -> None:
    """A2 — KeyUnavailableError from resolver surfaces as 503."""
    no_key = AsyncMock()
    no_key.resolve = AsyncMock(side_effect=KeyUnavailableError("no key configured"))
    provider_app.state.key_resolver = no_key

    resp = await client.post(
        "/api/v1/llm/complete",
        json={"prompt": "hello"},
        headers=INTERNAL_HEADERS,
    )

    assert resp.status_code == 503
    assert "No API key" in resp.json()["detail"]


async def test_llm_complete_502_on_nvidia_error(client: AsyncClient) -> None:
    """A3 — exception from litellm (NVIDIA returned 500) surfaces as 502."""
    with patch(
        "litellm.acompletion",
        new=AsyncMock(side_effect=Exception("upstream returned 500")),
    ):
        resp = await client.post(
            "/api/v1/llm/complete",
            json={"prompt": "hello"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 502


async def test_llm_complete_blocked_without_internal_token(client: AsyncClient) -> None:
    """A4 — InternalAuthMiddleware rejects requests with no X-Internal-Token."""
    resp = await client.post(
        "/api/v1/llm/complete",
        json={"prompt": "hello"},
        # Intentionally no X-Internal-Token
    )

    assert resp.status_code in (401, 403)


async def test_llm_complete_per_user_key_used(provider_app, client: AsyncClient) -> None:
    """A5 — per-user key is passed to litellm, not the system key."""
    mock_identity = AsyncMock()
    mock_identity.get_api_key = AsyncMock(return_value="user-nvapi-key")
    mock_identity.get_system_api_key = AsyncMock(return_value="test-nvapi-key")
    provider_app.state.key_resolver = KeyResolver(mock_identity, "nvidia_nim")

    mock_resp = _llm_mock_response("Hello")

    with patch("litellm.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_litellm:
        resp = await client.post(
            "/api/v1/llm/complete",
            json={"prompt": "Say hello"},
            headers={**INTERNAL_HEADERS, "X-User-ID": "user-99"},
        )

    assert resp.status_code == 200
    call_kwargs = mock_litellm.call_args.kwargs
    # Must use the per-user key, not the system fallback
    assert call_kwargs["api_key"] == "user-nvapi-key"


# ---------------------------------------------------------------------------
# B. Image route — POST /api/v1/image/generate
# ---------------------------------------------------------------------------


async def test_image_generate_success(client: AsyncClient) -> None:
    """B1 — successful image generation returns 200 with base64 artifact."""
    mock_data = {"artifacts": [{"base64": "aGVsbG8=", "seed": 42, "finishReason": "SUCCESS"}]}

    with patch("httpx.AsyncClient", _mock_httpx_client(json_resp=mock_data)):
        resp = await client.post(
            "/api/v1/image/generate",
            json={"prompt": "A red sunset"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["image_b64"] == "aGVsbG8="
    assert "nvidia_nim" in data["provider"]
    assert data["seed"] == 42


async def test_image_generate_503_no_key(provider_app, client: AsyncClient) -> None:
    """B2 — KeyUnavailableError from resolver surfaces as 503."""
    no_key = AsyncMock()
    no_key.resolve = AsyncMock(side_effect=KeyUnavailableError("no key configured"))
    provider_app.state.key_resolver = no_key

    resp = await client.post(
        "/api/v1/image/generate",
        json={"prompt": "A red sunset"},
        headers=INTERNAL_HEADERS,
    )

    assert resp.status_code == 503


async def test_image_generate_502_on_empty_artifacts(client: AsyncClient) -> None:
    """B3 — NVIDIA returns 200 but empty artifacts list → 502 from Provider."""
    with patch("httpx.AsyncClient", _mock_httpx_client(json_resp={"artifacts": []})):
        resp = await client.post(
            "/api/v1/image/generate",
            json={"prompt": "A red sunset"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 502
    assert "no artifacts" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# C. TTS route — POST /api/v1/tts/speak
# ---------------------------------------------------------------------------


async def test_tts_speak_success(client: AsyncClient) -> None:
    """C1 — successful TTS returns 200 with base64-encoded audio bytes."""
    audio_data = b"fake-audio-wav-data"

    with patch("httpx.AsyncClient", _mock_httpx_client(content=audio_data)):
        resp = await client.post(
            "/api/v1/tts/speak",
            json={"text": "Hello world"},
            headers=INTERNAL_HEADERS,
        )

    assert resp.status_code == 200
    data = resp.json()
    decoded = base64.b64decode(data["audio_b64"])
    assert decoded == audio_data
    assert data["format"] == "wav"


async def test_tts_speak_503_no_key(provider_app, client: AsyncClient) -> None:
    """C2 — KeyUnavailableError from resolver surfaces as 503."""
    no_key = AsyncMock()
    no_key.resolve = AsyncMock(side_effect=KeyUnavailableError("no key configured"))
    provider_app.state.key_resolver = no_key

    resp = await client.post(
        "/api/v1/tts/speak",
        json={"text": "Hello world"},
        headers=INTERNAL_HEADERS,
    )

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# D. Health route
# ---------------------------------------------------------------------------


async def test_health_returns_ok(client: AsyncClient) -> None:
    """D1 — GET /health requires no auth and returns status ok."""
    resp = await client.get("/health")

    assert resp.status_code == 200
    assert "ok" in resp.json()["status"].lower()
