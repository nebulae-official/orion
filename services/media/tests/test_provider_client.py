"""Unit tests for ProviderServiceImageClient header forwarding via shared provider_context."""

from __future__ import annotations

import base64

import httpx
import pytest
import respx
from orion_common.provider_context import request_user_id
from src.providers.base import ImageRequest
from src.providers.provider_client import ProviderServiceImageClient

_IMAGE_URL = "http://provider:8008/api/v1/image/generate"
_FAKE_PNG = base64.b64encode(b"FAKEPNGBYTES").decode()
_FAKE_RESPONSE = {
    "image_b64": _FAKE_PNG,
    "provider": "test",
    "width": 512,
    "height": 512,
    "seed": 1,
}


@respx.mock
async def test_header_forwarded_when_user_id_set(tmp_path: pytest.TempPathFactory) -> None:
    """X-User-ID is included in the image request when the contextvar is set."""
    route = respx.post(_IMAGE_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set("user-img-123")
    try:
        client = ProviderServiceImageClient(output_dir=str(tmp_path))
        await client.generate(ImageRequest(prompt="a sunset"))
    finally:
        request_user_id.reset(token)

    assert route.called
    assert route.calls.last.request.headers["x-user-id"] == "user-img-123"


@respx.mock
async def test_header_absent_when_user_id_unset(tmp_path: pytest.TempPathFactory) -> None:
    """X-User-ID is NOT included in the image request when the contextvar is unset."""
    route = respx.post(_IMAGE_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set(None)
    try:
        client = ProviderServiceImageClient(output_dir=str(tmp_path))
        await client.generate(ImageRequest(prompt="a sunset"))
    finally:
        request_user_id.reset(token)

    assert route.called
    assert "x-user-id" not in route.calls.last.request.headers


def test_request_user_id_imported_from_orion_common() -> None:
    """request_user_id used in media provider_client is the shared orion_common instance."""
    from src.providers import provider_client as pc

    assert pc.request_user_id is request_user_id
