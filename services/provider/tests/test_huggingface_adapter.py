"""Unit tests for the HuggingFace Inference API image adapter."""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from src.adapters.image.huggingface import HuggingFaceImageAdapter
from src.catalog import Capability, CredentialKind, ProviderEntry


@pytest.fixture()
def hf_entry() -> ProviderEntry:
    return ProviderEntry(
        provider="huggingface",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        default_model="black-forest-labs/FLUX.1-schnell",
        base_url="https://api-inference.huggingface.co",
    )


def _make_mock_client(image_bytes: bytes) -> tuple[MagicMock, MagicMock]:
    """Return (mock_class, mock_client) wired to respond with image_bytes."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = image_bytes

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    mock_class = MagicMock(return_value=mock_client)
    return mock_class, mock_client


@pytest.mark.asyncio
async def test_adapter_returns_base64_image(hf_entry: ProviderEntry) -> None:
    """Decoded image_b64 must equal the raw bytes returned by HuggingFace."""
    raw_image = b"\xff\xd8\xff" + b"\x00" * 200  # fake JPEG header
    mock_class, _ = _make_mock_client(raw_image)

    with patch("httpx.AsyncClient", mock_class):
        adapter = HuggingFaceImageAdapter(hf_entry)
        result = await adapter.generate(api_key="hf-test-token", prompt="A sunset")

    assert base64.b64decode(result.image_b64) == raw_image


@pytest.mark.asyncio
async def test_adapter_url_uses_model_path(hf_entry: ProviderEntry) -> None:
    """URL must be base_url/models/{model}."""
    raw_image = b"\x00" * 50
    captured_url: str | None = None

    async def capture_post(url, **kwargs):  # noqa: ARG001
        nonlocal captured_url
        captured_url = url
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = HuggingFaceImageAdapter(hf_entry)
        await adapter.generate(api_key="hf-token", prompt="A cat")

    assert (
        captured_url
        == "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    )


@pytest.mark.asyncio
async def test_adapter_sends_bearer_auth(hf_entry: ProviderEntry) -> None:
    """Authorization header must be 'Bearer {api_key}'."""
    raw_image = b"\x00" * 50
    captured_headers: dict | None = None

    async def capture_post(url, **kwargs):  # noqa: ARG001
        nonlocal captured_headers
        captured_headers = kwargs.get("headers")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = HuggingFaceImageAdapter(hf_entry)
        await adapter.generate(api_key="hf-secret-token", prompt="A forest")

    assert captured_headers is not None
    assert captured_headers["Authorization"] == "Bearer hf-secret-token"


@pytest.mark.asyncio
async def test_adapter_sends_inputs_and_parameters(hf_entry: ProviderEntry) -> None:
    """Payload must use 'inputs' for prompt and nest width/height under 'parameters'."""
    raw_image = b"\x00" * 50
    captured_json: dict | None = None

    async def capture_post(url, **kwargs):  # noqa: ARG001
        nonlocal captured_json
        captured_json = kwargs.get("json")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_image
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = HuggingFaceImageAdapter(hf_entry)
        await adapter.generate(api_key="hf-token", prompt="A mountain", width=512, height=768)

    assert captured_json is not None
    assert captured_json["inputs"] == "A mountain"
    assert captured_json["parameters"]["width"] == 512
    assert captured_json["parameters"]["height"] == 768


@pytest.mark.asyncio
async def test_adapter_seed_is_none(hf_entry: ProviderEntry) -> None:
    """HuggingFace never returns a seed — result.seed must always be None."""
    raw_image = b"\x00" * 50
    mock_class, _ = _make_mock_client(raw_image)

    with patch("httpx.AsyncClient", mock_class):
        adapter = HuggingFaceImageAdapter(hf_entry)
        result = await adapter.generate(api_key="hf-token", prompt="test", seed=99999)

    assert result.seed is None


@pytest.mark.asyncio
async def test_adapter_provider_tag_format(hf_entry: ProviderEntry) -> None:
    """provider_tag must be 'huggingface/{model}'."""
    raw_image = b"\x00" * 50
    mock_class, _ = _make_mock_client(raw_image)

    with patch("httpx.AsyncClient", mock_class):
        adapter = HuggingFaceImageAdapter(hf_entry)
        result = await adapter.generate(api_key="hf-token", prompt="test")

    assert result.provider_tag == "huggingface/black-forest-labs/FLUX.1-schnell"


@pytest.mark.asyncio
async def test_adapter_raises_502_on_http_error(hf_entry: ProviderEntry) -> None:
    """HTTP errors from HuggingFace must surface as 502 HTTPException."""
    import httpx

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "unavailable", request=MagicMock(), response=mock_resp
        )
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = HuggingFaceImageAdapter(hf_entry)
        with pytest.raises(HTTPException) as exc_info:
            await adapter.generate(api_key="hf-token", prompt="test")

    assert exc_info.value.status_code == 502
    assert "Image provider error" in exc_info.value.detail
