"""Fish Speech local TTS provider implementation."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import httpx
import structlog

from .base import TTSProvider, TTSRequest, TTSResult

logger = structlog.get_logger(__name__)

DEFAULT_FISH_SPEECH_URL = "http://localhost:8080"
DEFAULT_OUTPUT_DIR = "/tmp/orion/editor/tts"


def _estimate_audio_duration(file_path: str, output_format: str) -> float:
    """Estimate audio duration from file size.

    Fish Speech typically outputs at ~128 kbps for MP3 and ~256 kbps for WAV.
    """
    file_size = os.path.getsize(file_path)
    if output_format == "wav":
        # 16-bit mono at 24 kHz = 48000 bytes/sec
        return file_size / 48_000
    # MP3 at 128 kbps
    return file_size / (128_000 / 8)


class FishSpeechProvider(TTSProvider):
    """Text-to-speech provider using a local Fish Speech API instance.

    Fish Speech supports voice cloning via reference audio and generates
    high-quality TTS locally without cloud API costs.

    Requires a running Fish Speech server (default ``http://localhost:8080``).
    """

    def __init__(
        self,
        base_url: str | None = None,
        output_dir: str = DEFAULT_OUTPUT_DIR,
    ) -> None:
        self._base_url = (base_url or os.getenv("FISH_SPEECH_URL", DEFAULT_FISH_SPEECH_URL)).rstrip(
            "/"
        )
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def synthesize(self, request: TTSRequest) -> TTSResult:
        """Call the Fish Speech TTS endpoint and save the resulting audio."""
        url = f"{self._base_url}/v1/tts"

        payload: dict = {
            "text": request.text,
            "format": request.output_format,
            "speed": request.speed,
        }

        # Voice cloning: if voice_id looks like a file path, use it as
        # reference audio; otherwise treat it as a named voice preset.
        if request.voice_id != "default":
            if Path(request.voice_id).exists():
                payload["reference_audio"] = request.voice_id
            else:
                payload["speaker"] = request.voice_id

        file_name = f"{uuid.uuid4()}.{request.output_format}"
        file_path = self._output_dir / file_name

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            file_path.write_bytes(response.content)

        duration = _estimate_audio_duration(str(file_path), request.output_format)

        await logger.ainfo(
            "tts_synthesized",
            provider="fish_speech",
            voice_id=request.voice_id,
            duration=duration,
            file_path=str(file_path),
        )

        return TTSResult(
            file_path=str(file_path),
            duration_seconds=duration,
            provider="fish_speech",
        )

    async def list_voices(self) -> list[dict]:
        """Fetch available voices from the Fish Speech server."""
        url = f"{self._base_url}/v1/voices"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            logger.warning("fish_speech_list_voices_failed", error=str(exc))
            return []

        voices = [
            {
                "voice_id": v.get("id", v.get("name", "unknown")),
                "name": v.get("name", "unknown"),
                "category": "local",
                "labels": v.get("labels", {}),
            }
            for v in data.get("voices", [])
        ]
        return voices

    async def is_available(self) -> bool:
        """Return True if the Fish Speech server is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/v1/health")
                return resp.status_code == 200
        except Exception:
            return False
