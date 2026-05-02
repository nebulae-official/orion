"""Provider Service TTS client — delegates speech synthesis to the centralized provider service."""

from __future__ import annotations

import base64
import os
import wave
from pathlib import Path
from uuid import uuid4

import httpx
import structlog
from orion_common.provider_context import request_user_id

from .base import TTSProvider, TTSRequest, TTSResult

logger = structlog.get_logger(__name__)


def _wav_duration(file_path: str) -> float:
    with wave.open(file_path, "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


class ProviderServiceTTSClient(TTSProvider):
    """Synthesize speech by calling the Orion Provider Service REST API.

    The provider service handles NVIDIA Magpie credentials; this client only
    needs PROVIDER_URL and is credential-free.
    """

    def __init__(self, output_dir: str | None = None) -> None:
        self._provider_url = os.environ.get("PROVIDER_URL", "http://provider:8008").rstrip("/")
        self._output_dir = Path(
            output_dir or os.environ.get("EDITOR_OUTPUT_DIR", "/tmp/orion/editor/tts")
        )
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def synthesize(self, request: TTSRequest) -> TTSResult:
        voice = os.environ.get("PROVIDER_TTS_VOICE", "Magpie-Multilingual.EN-US.Aria")
        fmt = request.output_format if request.output_format != "mp3" else "wav"

        payload = {
            "text": request.text,
            "voice": voice,
            "speed": request.speed,
            "response_format": fmt,
        }

        headers: dict[str, str] = {}
        user_id = request_user_id.get()
        if user_id:
            headers["X-User-ID"] = user_id

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self._provider_url}/api/v1/tts/speak",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # provider service unreachable or returned an error
            logger.error("provider_tts_request_failed", error=str(exc))
            raise

        audio_bytes = base64.b64decode(data["audio_b64"])
        dest = self._output_dir / f"tts_{uuid4().hex}.wav"
        dest.write_bytes(audio_bytes)

        duration = _wav_duration(str(dest))

        logger.info("tts_saved", path=str(dest), provider=data.get("provider"), duration=duration)

        return TTSResult(
            file_path=str(dest),
            duration_seconds=duration,
            provider=data.get("provider", "nvidia_nim/magpie-tts-multilingual"),
        )

    async def list_voices(self) -> list[dict]:
        return [
            {
                "voice_id": "Magpie-Multilingual.EN-US.Aria",
                "name": "Aria (EN-US)",
                "category": "nvidia_magpie",
            },
            {
                "voice_id": "Magpie-Multilingual.EN-US.Ryan",
                "name": "Ryan (EN-US)",
                "category": "nvidia_magpie",
            },
        ]

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._provider_url}/health")
                return resp.status_code == 200
        except Exception:  # provider unreachable — treat as unavailable
            return False
