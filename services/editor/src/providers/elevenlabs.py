"""ElevenLabs cloud TTS provider implementation."""

from __future__ import annotations

import os
import uuid
import wave
from pathlib import Path

import httpx
import structlog

from .base import TTSProvider, TTSRequest, TTSResult

logger = structlog.get_logger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" default voice
DEFAULT_OUTPUT_DIR = "/tmp/orion/editor/tts"


def _get_mp3_duration(file_path: str) -> float:
    """Estimate MP3 duration by file size and typical bitrate.

    For precise duration a library like mutagen would be used, but we
    keep dependencies minimal and use a bitrate-based estimate.  The
    ElevenLabs API defaults to 128 kbps MP3.
    """
    file_size = os.path.getsize(file_path)
    bitrate_bytes_per_sec = 128_000 / 8  # 128 kbps
    return file_size / bitrate_bytes_per_sec


def _get_wav_duration(file_path: str) -> float:
    """Get exact duration of a WAV file."""
    with wave.open(file_path, "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)


def _get_audio_duration(file_path: str) -> float:
    """Return the duration of an audio file in seconds."""
    if file_path.endswith(".wav"):
        return _get_wav_duration(file_path)
    return _get_mp3_duration(file_path)


class ElevenLabsProvider(TTSProvider):
    """Text-to-speech provider using the ElevenLabs REST API.

    Requires the ``ELEVENLABS_API_KEY`` environment variable to be set.
    Audio files are saved to *output_dir* (default ``/tmp/orion/editor/tts``).
    """

    def __init__(
        self,
        api_key: str | None = None,
        output_dir: str = DEFAULT_OUTPUT_DIR,
    ) -> None:
        self._api_key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def synthesize(self, request: TTSRequest) -> TTSResult:
        """Call ElevenLabs TTS endpoint and save the resulting audio."""
        voice_id = request.voice_id if request.voice_id != "default" else DEFAULT_VOICE_ID
        url = f"{ELEVENLABS_BASE_URL}/v1/text-to-speech/{voice_id}"

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": f"audio/{request.output_format}",
        }

        body = {
            "text": request.text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "speed": request.speed,
            },
        }

        file_name = f"{uuid.uuid4()}.{request.output_format}"
        file_path = self._output_dir / file_name

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()

            file_path.write_bytes(response.content)

        duration = _get_audio_duration(str(file_path))

        await logger.ainfo(
            "tts_synthesized",
            provider="elevenlabs",
            voice_id=voice_id,
            duration=duration,
            file_path=str(file_path),
        )

        return TTSResult(
            file_path=str(file_path),
            duration_seconds=duration,
            provider="elevenlabs",
        )

    async def list_voices(self) -> list[dict]:
        """Fetch available voices from ElevenLabs."""
        url = f"{ELEVENLABS_BASE_URL}/v1/voices"
        headers = {"xi-api-key": self._api_key}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()

        voices = [
            {
                "voice_id": v["voice_id"],
                "name": v["name"],
                "category": v.get("category", "unknown"),
                "labels": v.get("labels", {}),
            }
            for v in data.get("voices", [])
        ]
        return voices

    async def is_available(self) -> bool:
        """Return True if the ElevenLabs API key is configured."""
        return bool(self._api_key)
