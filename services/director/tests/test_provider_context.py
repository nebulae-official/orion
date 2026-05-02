"""Unit tests for ProviderServiceClient header forwarding via shared provider_context."""

from __future__ import annotations

import httpx
import respx
from orion_common.provider_context import request_user_id

from src.providers.provider_client import ProviderServiceClient

_LLM_URL = "http://provider:8008/api/v1/llm/complete"
_FAKE_RESPONSE = {"content": "Hello", "model": "test-model", "usage": None}


@respx.mock
async def test_header_forwarded_when_user_id_set() -> None:
    """X-User-ID is included in the request when the contextvar is set."""
    route = respx.post(_LLM_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set("user-abc")
    try:
        client = ProviderServiceClient()
        await client.generate("test prompt")
    finally:
        request_user_id.reset(token)

    assert route.called
    assert route.calls.last.request.headers["x-user-id"] == "user-abc"


@respx.mock
async def test_header_absent_when_user_id_unset() -> None:
    """X-User-ID is NOT included in the request when the contextvar is unset."""
    route = respx.post(_LLM_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set(None)
    try:
        client = ProviderServiceClient()
        await client.generate("test prompt")
    finally:
        request_user_id.reset(token)

    assert route.called
    assert "x-user-id" not in route.calls.last.request.headers


@respx.mock
async def test_generate_returns_llm_response() -> None:
    """Director behavior preserved: generate() returns a populated LLMResponse."""
    respx.post(_LLM_URL).mock(return_value=httpx.Response(200, json={"content": "Generated text", "model": "nim/llama3", "usage": {"tokens": 10}}))

    client = ProviderServiceClient()
    result = await client.generate("prompt", system_prompt="be helpful", temperature=0.5)

    assert result.content == "Generated text"
    assert result.model == "nim/llama3"
    assert result.usage == {"tokens": 10}


def test_request_user_id_imported_from_orion_common() -> None:
    """request_user_id is the shared instance from orion_common.provider_context."""
    from src.providers import provider_client as pc

    assert pc.request_user_id is request_user_id
