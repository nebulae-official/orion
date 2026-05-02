"""Unit tests for the NVIDIA Riva TTS adapter (ORION-258).

Verifies:
- gRPC Auth metadata contains authorization Bearer + NVCF function-id
- WAV container wrapping of raw LINEAR_PCM response bytes
- Raw PCM pass-through when response_format != "wav"
- provider_tag format compatibility
- 502 surfacing on gRPC errors
"""

from __future__ import annotations

import base64
import io
import wave
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from src.adapters.tts.nvidia_nim import NvidiaNimTTSAdapter, _pcm_to_wav
from src.catalog import Capability, get_entry

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_FAKE_API_KEY = "nvapi-test-key-unit"
_EXPECTED_FUNCTION_ID = "877104f7-e885-42b9-8de8-f6e4c6303969"


@pytest.fixture()
def tts_entry():
    return get_entry(Capability.TTS)


@pytest.fixture()
def fake_pcm() -> bytes:
    return b"\x00\x00" * 200  # 200 frames of 16-bit silence


@pytest.fixture()
def mock_riva(fake_pcm: bytes):
    """Patch riva.client.Auth and SpeechSynthesisService for the duration of a test."""
    mock_resp = MagicMock()
    mock_resp.audio = fake_pcm

    mock_tts = MagicMock()
    mock_tts.synthesize.return_value = mock_resp

    with (
        patch("riva.client.Auth") as mock_auth,
        patch("riva.client.SpeechSynthesisService", return_value=mock_tts) as mock_svc,
    ):
        yield mock_auth, mock_svc, mock_tts


# ---------------------------------------------------------------------------
# Auth metadata / function-id injection
# ---------------------------------------------------------------------------


async def test_adapter_sends_bearer_and_function_id(tts_entry, mock_riva) -> None:
    """Adapter must pass authorization Bearer + NVCF function-id in gRPC metadata."""
    mock_auth, _, _ = mock_riva

    adapter = NvidiaNimTTSAdapter(tts_entry)
    await adapter.speak(api_key=_FAKE_API_KEY, text="hello")

    auth_call_kwargs = mock_auth.call_args.kwargs
    metadata: list[list[str]] = auth_call_kwargs["metadata_args"]
    header_keys = [m[0] for m in metadata]

    assert "authorization" in header_keys
    assert "function-id" in header_keys

    auth_val = next(m[1] for m in metadata if m[0] == "authorization")
    assert auth_val.startswith("Bearer ")
    # Key must be forwarded — absence would be a silent auth failure
    assert _FAKE_API_KEY in auth_val

    func_id = next(m[1] for m in metadata if m[0] == "function-id")
    assert func_id == _EXPECTED_FUNCTION_ID


async def test_adapter_uses_catalog_base_url_as_grpc_uri(tts_entry, mock_riva) -> None:
    """gRPC Auth uri must be the catalog entry's base_url."""
    mock_auth, _, _ = mock_riva

    adapter = NvidiaNimTTSAdapter(tts_entry)
    await adapter.speak(api_key=_FAKE_API_KEY, text="ping")

    call_kwargs = mock_auth.call_args.kwargs
    assert call_kwargs["uri"] == tts_entry.base_url
    assert call_kwargs["use_ssl"] is True


# ---------------------------------------------------------------------------
# WAV container wrapping
# ---------------------------------------------------------------------------


async def test_adapter_returns_valid_wav(tts_entry, mock_riva) -> None:
    """Decoded audio_b64 must be a valid WAV file readable by wave.open."""
    adapter = NvidiaNimTTSAdapter(tts_entry)
    result = await adapter.speak(api_key=_FAKE_API_KEY, text="hello world", response_format="wav")

    wav_bytes = base64.b64decode(result.audio_b64)
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, "rb") as wf:
        assert wf.getframerate() == 44100
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2


async def test_adapter_raw_format_skips_wav_wrapping(tts_entry, mock_riva, fake_pcm: bytes) -> None:
    """When response_format != 'wav', raw PCM bytes are returned without a WAV header."""
    adapter = NvidiaNimTTSAdapter(tts_entry)
    result = await adapter.speak(api_key=_FAKE_API_KEY, text="hello", response_format="pcm")

    decoded = base64.b64decode(result.audio_b64)
    assert decoded == fake_pcm


# ---------------------------------------------------------------------------
# _pcm_to_wav unit — isolated helper
# ---------------------------------------------------------------------------


def test_pcm_to_wav_correct_parameters() -> None:
    """_pcm_to_wav wraps silence with the expected WAV header parameters."""
    pcm = b"\x00\x00" * 1000  # 1000 frames
    wav = _pcm_to_wav(pcm, sample_rate=22050)

    buf = io.BytesIO(wav)
    with wave.open(buf, "rb") as wf:
        assert wf.getframerate() == 22050
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getnframes() == 1000


# ---------------------------------------------------------------------------
# Provider tag compatibility
# ---------------------------------------------------------------------------


async def test_adapter_provider_tag_format(tts_entry, mock_riva) -> None:
    """provider_tag must be 'nvidia_nim/{model}' for Editor backward compatibility."""
    adapter = NvidiaNimTTSAdapter(tts_entry)
    result = await adapter.speak(api_key=_FAKE_API_KEY, text="hello")

    assert result.provider_tag.startswith("nvidia_nim/")
    assert tts_entry.default_model in result.provider_tag


async def test_adapter_provider_tag_uses_override_model(tts_entry, mock_riva) -> None:
    """Explicit model kwarg overrides the catalog default in provider_tag."""
    adapter = NvidiaNimTTSAdapter(tts_entry)
    result = await adapter.speak(api_key=_FAKE_API_KEY, text="hello", model="nvidia/custom-tts")

    assert result.provider_tag == "nvidia_nim/nvidia/custom-tts"


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


async def test_adapter_raises_502_on_grpc_error(tts_entry) -> None:
    """gRPC errors from Riva must be caught and surfaced as 502 HTTPException."""
    mock_tts = MagicMock()
    mock_tts.synthesize.side_effect = Exception("grpc: unavailable")

    with (
        patch("riva.client.Auth"),
        patch("riva.client.SpeechSynthesisService", return_value=mock_tts),
    ):
        adapter = NvidiaNimTTSAdapter(tts_entry)
        with pytest.raises(HTTPException) as exc_info:
            await adapter.speak(api_key=_FAKE_API_KEY, text="hello")

    assert exc_info.value.status_code == 502
    assert "TTS provider error" in exc_info.value.detail
