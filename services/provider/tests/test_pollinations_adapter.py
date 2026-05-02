"""Unit tests for the Pollinations image adapter."""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from src.adapters.image.pollinations import PollinationsImageAdapter
from src.catalog import Capability, CredentialKind, ProviderEntry


@pytest.fixture()
def poll_entry() -> ProviderEntry:
    return ProviderEntry(
        provider="pollinations",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        default_model="flux",
        base_url="https://image.pollinations.ai",
    )


def _make_mock_client(image_bytes: bytes) -> tuple[MagicMock, MagicMock]:
    """Return (mock_class, mock_client) wired to respond with image_bytes."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = image_bytes

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    mock_class = MagicMock(return_value=mock_client)
    return mock_class, mock_client


@pytest.mark.asyncio
async def test_adapter_returns_base64_image(poll_entry: ProviderEntry) -> None:
    """Decoded image_b64 must equal the raw bytes returned by Pollinations."""
    raw_image = b"\xff\xd8\xff" + b"\x00" * 300
    mock_class, _ = _make_mock_client(raw_image)

    with patch("httpx.AsyncClient", mock_class):
        adapter = PollinationsImageAdapter(poll_entry)
        result = await adapter.generate(api_key="ignored", prompt="A sunset")

    assert base64.b64decode(result.image_b64) == raw_image


@pytest.mark.asyncio
async def test_adapter_url_encodes_prompt(poll_entry: ProviderEntry) -> None:
    """Prompt must be URL-encoded in the request path."""
    raw_image = b"\x00" * 50
    captured_url: str | None = None

    async def capture_get(url, **kwargs):  # noqa: ARG001
        nonlocal captured_url
        captured_url = url
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=capture_get)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        await adapter.generate(api_key="", prompt="a cat in a hat")

    assert captured_url == "https://image.pollinations.ai/prompt/a%20cat%20in%20a%20hat"


@pytest.mark.asyncio
async def test_adapter_sends_correct_params(poll_entry: ProviderEntry) -> None:
    """Query params must include width, height, model, nologo=true."""
    raw_image = b"\x00" * 50
    captured_params: dict | None = None

    async def capture_get(url, **kwargs):  # noqa: ARG001
        nonlocal captured_params
        captured_params = kwargs.get("params")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=capture_get)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        await adapter.generate(api_key="", prompt="test", width=768, height=1024)

    assert captured_params is not None
    assert captured_params["width"] == 768
    assert captured_params["height"] == 1024
    assert captured_params["model"] == "flux"
    assert captured_params["nologo"] == "true"


@pytest.mark.asyncio
async def test_adapter_includes_seed_when_provided(poll_entry: ProviderEntry) -> None:
    """seed must be in params when given, and result.seed must match."""
    raw_image = b"\x00" * 50
    captured_params: dict | None = None

    async def capture_get(url, **kwargs):  # noqa: ARG001
        nonlocal captured_params
        captured_params = kwargs.get("params")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=capture_get)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        result = await adapter.generate(api_key="", prompt="test", seed=42)

    assert captured_params is not None
    assert captured_params["seed"] == 42
    assert result.seed == 42


@pytest.mark.asyncio
async def test_adapter_omits_seed_when_none(poll_entry: ProviderEntry) -> None:
    """seed must NOT appear in params when not provided."""
    raw_image = b"\x00" * 50
    captured_params: dict | None = None

    async def capture_get(url, **kwargs):  # noqa: ARG001
        nonlocal captured_params
        captured_params = kwargs.get("params")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=capture_get)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        await adapter.generate(api_key="", prompt="test")

    assert captured_params is not None
    assert "seed" not in captured_params


@pytest.mark.asyncio
async def test_adapter_provider_tag_format(poll_entry: ProviderEntry) -> None:
    """provider_tag must be 'pollinations/{model}'."""
    raw_image = b"\x00" * 50
    mock_class, _ = _make_mock_client(raw_image)

    with patch("httpx.AsyncClient", mock_class):
        adapter = PollinationsImageAdapter(poll_entry)
        result = await adapter.generate(api_key="", prompt="test")

    assert result.provider_tag == "pollinations/flux"


@pytest.mark.asyncio
async def test_adapter_raises_502_on_http_error(poll_entry: ProviderEntry) -> None:
    """HTTP errors from Pollinations must surface as 502 HTTPException."""
    import httpx

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "rate limited", request=MagicMock(), response=mock_resp
        )
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        with pytest.raises(HTTPException) as exc_info:
            await adapter.generate(api_key="", prompt="test")

    assert exc_info.value.status_code == 502
    assert "Image provider error" in exc_info.value.detail


@pytest.mark.asyncio
async def test_adapter_ignores_api_key(poll_entry: ProviderEntry) -> None:
    """Pollinations is keyless — api_key must not appear anywhere in request."""
    raw_image = b"\x00" * 50
    captured_headers: dict | None = None
    captured_params: dict | None = None

    async def capture_get(url, **kwargs):  # noqa: ARG001
        nonlocal captured_headers, captured_params
        captured_headers = kwargs.get("headers")
        captured_params = kwargs.get("params")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=capture_get)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = PollinationsImageAdapter(poll_entry)
        await adapter.generate(api_key="should-be-ignored", prompt="test")

    # No Authorization header injected
    assert captured_headers is None or "Authorization" not in (captured_headers or {})
