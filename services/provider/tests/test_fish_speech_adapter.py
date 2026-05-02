"""Unit tests for the FishSpeech TTS adapter."""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from src.adapters.tts.fish_speech import FishSpeechTTSAdapter
from src.catalog import Capability, CredentialKind, ProviderEntry


@pytest.fixture()
def fish_entry() -> ProviderEntry:
    return ProviderEntry(
        provider="fish_speech",
        capability=Capability.TTS,
        credential_kind=CredentialKind.API_KEY,
        default_model="default",
        base_url="http://fish_speech:8080",
        default_voice="default",
    )


def _make_mock_client(audio_bytes: bytes) -> tuple[MagicMock, MagicMock]:
    """Return (mock_class, mock_client) wired to respond with audio_bytes."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.content = audio_bytes

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    mock_class = MagicMock(return_value=mock_client)
    return mock_class, mock_client


@pytest.mark.asyncio
async def test_adapter_returns_base64_audio(fish_entry: ProviderEntry) -> None:
    """Decoded audio_b64 must equal the raw bytes returned by the server."""
    raw_audio = b"\xff\xfe" * 100
    mock_class, _ = _make_mock_client(raw_audio)

    with patch("httpx.AsyncClient", mock_class):
        adapter = FishSpeechTTSAdapter(fish_entry)
        result = await adapter.speak(api_key="", text="hello")

    assert base64.b64decode(result.audio_b64) == raw_audio
    assert result.format == "wav"


@pytest.mark.asyncio
async def test_adapter_sends_speaker_when_voice_provided(fish_entry: ProviderEntry) -> None:
    """'speaker' key must appear in payload when voice is given."""
    raw_audio = b"\x00\x01" * 50
    captured_json: dict | None = None

    async def capture_post(*args, **kwargs):  # noqa: ARG001
        nonlocal captured_json
        captured_json = kwargs.get("json")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_audio
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = FishSpeechTTSAdapter(fish_entry)
        await adapter.speak(api_key="", text="hello", voice="custom_voice")

    assert captured_json is not None
    assert captured_json["speaker"] == "custom_voice"


@pytest.mark.asyncio
async def test_adapter_omits_speaker_when_voice_is_none(fish_entry: ProviderEntry) -> None:
    """'speaker' key must be absent when voice=None and entry has no default_voice."""
    entry_no_voice = ProviderEntry(
        provider="fish_speech",
        capability=Capability.TTS,
        credential_kind=CredentialKind.API_KEY,
        default_model="default",
        base_url="http://fish_speech:8080",
        default_voice=None,
    )
    raw_audio = b"\x00" * 50
    captured_json: dict | None = None

    async def capture_post(*args, **kwargs):  # noqa: ARG001
        nonlocal captured_json
        captured_json = kwargs.get("json")
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_audio
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = FishSpeechTTSAdapter(entry_no_voice)
        await adapter.speak(api_key="", text="hello", voice=None)

    assert captured_json is not None
    assert "speaker" not in captured_json


@pytest.mark.asyncio
async def test_adapter_uses_api_key_as_base_url(fish_entry: ProviderEntry) -> None:
    """When api_key is a URL, it overrides the catalog entry's base_url."""
    raw_audio = b"\x00" * 20
    captured_url: str | None = None

    async def capture_post(url, **kwargs):  # noqa: ARG001
        nonlocal captured_url
        captured_url = url
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.content = raw_audio
        return mock_resp

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=capture_post)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = FishSpeechTTSAdapter(fish_entry)
        await adapter.speak(api_key="http://custom-server:9000", text="hello")

    assert captured_url == "http://custom-server:9000/v1/tts"


@pytest.mark.asyncio
async def test_adapter_provider_tag_format(fish_entry: ProviderEntry) -> None:
    """provider_tag must be 'fish_speech/{model}'."""
    raw_audio = b"\x00" * 20
    mock_class, _ = _make_mock_client(raw_audio)

    with patch("httpx.AsyncClient", mock_class):
        adapter = FishSpeechTTSAdapter(fish_entry)
        result = await adapter.speak(api_key="", text="hello")

    assert result.provider_tag == "fish_speech/default"


@pytest.mark.asyncio
async def test_adapter_raises_502_on_http_error(fish_entry: ProviderEntry) -> None:
    """HTTP 4xx/5xx from FishSpeech server must surface as 502 HTTPException."""
    import httpx

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "server error", request=MagicMock(), response=mock_resp
        )
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = FishSpeechTTSAdapter(fish_entry)
        with pytest.raises(HTTPException) as exc_info:
            await adapter.speak(api_key="", text="hello")

    assert exc_info.value.status_code == 502
    assert "TTS provider error" in exc_info.value.detail


@pytest.mark.asyncio
async def test_adapter_raises_502_on_network_error(fish_entry: ProviderEntry) -> None:
    """Network-level failures must surface as 502 HTTPException."""
    import httpx

    with patch("httpx.AsyncClient") as mock_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_class.return_value = mock_client

        adapter = FishSpeechTTSAdapter(fish_entry)
        with pytest.raises(HTTPException) as exc_info:
            await adapter.speak(api_key="", text="hello")

    assert exc_info.value.status_code == 502
