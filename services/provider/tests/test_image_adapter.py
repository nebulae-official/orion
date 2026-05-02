"""Unit tests for image generation adapters — validates payload structure."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from src.adapters.image.nvidia_nim import NvidiaNimImageAdapter
from src.catalog import Capability, CredentialKind, ProviderEntry


@pytest.fixture
def nvidia_entry() -> ProviderEntry:
    """Fixture for NVIDIA provider entry."""
    return ProviderEntry(
        provider="nvidia_nim",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        base_url="https://ai.api.nvidia.com/v1/genai",
        default_model="black-forest-labs/flux.1-schnell",
    )


@pytest.mark.asyncio
async def test_nvidia_image_adapter_uses_steps_key(nvidia_entry: ProviderEntry) -> None:
    """Verify that NVIDIA adapter sends 'steps' key (not 'num_inference_steps')."""
    adapter = NvidiaNimImageAdapter(nvidia_entry)

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"artifacts": [{"base64": "aGVsbG8=", "seed": 42}]}

    captured_json = None

    async def capture_post(*args, **kwargs):  # noqa: ARG001
        nonlocal captured_json
        captured_json = kwargs.get("json")
        return mock_response

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        result = await adapter.generate(
            api_key="test-key",
            prompt="A sunset",
            steps=3,
        )

    # Verify the adapter returned a valid result
    assert result.image_b64 == "aGVsbG8="
    assert result.seed == 42

    # Verify the outgoing payload uses 'steps', not 'num_inference_steps'
    assert captured_json is not None
    assert "steps" in captured_json, "Payload must contain 'steps' key"
    assert captured_json["steps"] == 3
    assert "num_inference_steps" not in captured_json, (
        "Payload must NOT contain 'num_inference_steps' (NVIDIA FLUX expects 'steps')"
    )
    assert captured_json["prompt"] == "A sunset"


@pytest.mark.asyncio
async def test_nvidia_image_adapter_includes_optional_fields(
    nvidia_entry: ProviderEntry,
) -> None:
    """Verify that optional fields (negative_prompt, seed) are included in payload."""
    adapter = NvidiaNimImageAdapter(nvidia_entry)

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"artifacts": [{"base64": "aGVsbG8=", "seed": 99}]}

    captured_json = None

    async def capture_post(*args, **kwargs):  # noqa: ARG001
        nonlocal captured_json
        captured_json = kwargs.get("json")
        return mock_response

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        await adapter.generate(
            api_key="test-key",
            prompt="A sunset",
            steps=2,
            negative_prompt="blurry",
            seed=12345,
            width=512,
            height=768,
        )

    # Verify optional fields are present
    assert captured_json["negative_prompt"] == "blurry"
    assert captured_json["seed"] == 12345
    assert captured_json["width"] == 512
    assert captured_json["height"] == 768
