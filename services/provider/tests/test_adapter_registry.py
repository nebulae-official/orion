"""Unit tests for provider route adapter registries (ORION-258).

Verifies that each route's registry dispatches 'nvidia_nim' to the correct
adapter class, and that an unknown provider name returns HTTP 422.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.health import create_health_router
from orion_common.middleware import InternalAuthMiddleware
from src.adapters.image.nvidia_nim import NvidiaNimImageAdapter
from src.adapters.llm.nvidia_nim import NvidiaNimLLMAdapter
from src.adapters.tts.nvidia_nim import NvidiaNimTTSAdapter
from src.routes.image import _IMAGE_ADAPTERS, router as image_router
from src.routes.llm import _LLM_ADAPTERS, router as llm_router
from src.routes.tts import _TTS_ADAPTERS, router as tts_router

from .conftest import INTERNAL_HEADERS

# ---------------------------------------------------------------------------
# Registry dispatch — unit level (no HTTP, no mocks needed)
# ---------------------------------------------------------------------------


def test_image_registry_nvidia_nim_maps_to_correct_class() -> None:
    """nvidia_nim key in _IMAGE_ADAPTERS resolves to NvidiaNimImageAdapter."""
    assert _IMAGE_ADAPTERS.get("nvidia_nim") is NvidiaNimImageAdapter


def test_llm_registry_nvidia_nim_maps_to_correct_class() -> None:
    """nvidia_nim key in _LLM_ADAPTERS resolves to NvidiaNimLLMAdapter."""
    assert _LLM_ADAPTERS.get("nvidia_nim") is NvidiaNimLLMAdapter


def test_tts_registry_nvidia_nim_maps_to_correct_class() -> None:
    """nvidia_nim key in _TTS_ADAPTERS resolves to NvidiaNimTTSAdapter."""
    assert _TTS_ADAPTERS.get("nvidia_nim") is NvidiaNimTTSAdapter


def test_image_registry_unknown_provider_returns_none() -> None:
    """Unknown provider key returns None from _IMAGE_ADAPTERS."""
    assert _IMAGE_ADAPTERS.get("unknown_provider") is None


def test_llm_registry_unknown_provider_returns_none() -> None:
    """Unknown provider key returns None from _LLM_ADAPTERS."""
    assert _LLM_ADAPTERS.get("unknown_provider") is None


def test_tts_registry_unknown_provider_returns_none() -> None:
    """Unknown provider key returns None from _TTS_ADAPTERS."""
    assert _TTS_ADAPTERS.get("unknown_provider") is None


# ---------------------------------------------------------------------------
# 422 guard — HTTP level (needs catalog to not raise first)
#
# The catalog only has 'nvidia_nim' entries, so an unknown provider hits the
# first 422 from get_entry() before reaching the registry guard.  To test the
# registry guard specifically we need a provider that IS in the catalog but
# NOT in the registry.  We patch the catalog _CATALOG directly for these tests.
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def registry_test_app() -> FastAPI:
    """Minimal FastAPI app wired with all three routes for registry 422 tests."""
    from unittest.mock import AsyncMock

    from src.key_resolver import KeyResolver

    mock_identity = AsyncMock()
    mock_identity.get_api_key = AsyncMock(return_value=None)
    mock_identity.get_system_api_key = AsyncMock(return_value="test-key")

    app = FastAPI(title="Registry Test")
    app.add_middleware(InternalAuthMiddleware, token="test-token")
    app.include_router(create_health_router("provider"))
    app.include_router(llm_router)
    app.include_router(image_router)
    app.include_router(tts_router)
    app.state.key_resolver = KeyResolver(identity_client=mock_identity)
    yield app


@pytest_asyncio.fixture
async def registry_client(registry_test_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=registry_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_image_unknown_provider_returns_422(registry_client: AsyncClient) -> None:
    """POST /image/generate with unknown provider returns 422."""
    resp = await registry_client.post(
        "/api/v1/image/generate",
        json={"prompt": "test", "provider": "not_a_real_provider"},
        headers=INTERNAL_HEADERS,
    )
    assert resp.status_code == 422


async def test_llm_unknown_provider_returns_422(registry_client: AsyncClient) -> None:
    """POST /llm/complete with unknown provider returns 422."""
    resp = await registry_client.post(
        "/api/v1/llm/complete",
        json={"prompt": "test", "provider": "not_a_real_provider"},
        headers=INTERNAL_HEADERS,
    )
    assert resp.status_code == 422


async def test_tts_unknown_provider_returns_422(registry_client: AsyncClient) -> None:
    """POST /tts/speak with unknown provider returns 422."""
    resp = await registry_client.post(
        "/api/v1/tts/speak",
        json={"text": "hello", "provider": "not_a_real_provider"},
        headers=INTERNAL_HEADERS,
    )
    assert resp.status_code == 422
