"""Unit tests for ProviderServiceTTSClient header forwarding via shared provider_context."""

from __future__ import annotations

import base64
from unittest.mock import patch

import httpx
import pytest
import respx
from orion_common.provider_context import request_user_id
from src.providers.base import TTSRequest
from src.providers.provider_client import ProviderServiceTTSClient

_TTS_URL = "http://provider:8008/api/v1/tts/speak"
_FAKE_AUDIO = base64.b64encode(b"FAKEAUDIOBYTES").decode()
_FAKE_RESPONSE = {"audio_b64": _FAKE_AUDIO, "provider": "test"}
_FAKE_DURATION = 3.5


def _make_client(tmp_path: str) -> ProviderServiceTTSClient:
    return ProviderServiceTTSClient(output_dir=tmp_path)


@respx.mock
async def test_header_forwarded_when_user_id_set(tmp_path: pytest.TempPathFactory) -> None:
    """X-User-ID is included in the TTS request when the contextvar is set."""
    route = respx.post(_TTS_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set("user-tts-999")
    try:
        with patch("src.providers.provider_client._wav_duration", return_value=_FAKE_DURATION):
            client = _make_client(str(tmp_path))
            await client.synthesize(TTSRequest(text="Hello world"))
    finally:
        request_user_id.reset(token)

    assert route.called
    assert route.calls.last.request.headers["x-user-id"] == "user-tts-999"


@respx.mock
async def test_header_absent_when_user_id_unset(tmp_path: pytest.TempPathFactory) -> None:
    """X-User-ID is NOT included in the TTS request when the contextvar is unset."""
    route = respx.post(_TTS_URL).mock(return_value=httpx.Response(200, json=_FAKE_RESPONSE))

    token = request_user_id.set(None)
    try:
        with patch("src.providers.provider_client._wav_duration", return_value=_FAKE_DURATION):
            client = _make_client(str(tmp_path))
            await client.synthesize(TTSRequest(text="Hello world"))
    finally:
        request_user_id.reset(token)

    assert route.called
    assert "x-user-id" not in route.calls.last.request.headers


def test_request_user_id_imported_from_orion_common() -> None:
    """request_user_id used in editor provider_client is the shared orion_common instance."""
    from src.providers import provider_client as pc

    assert pc.request_user_id is request_user_id
