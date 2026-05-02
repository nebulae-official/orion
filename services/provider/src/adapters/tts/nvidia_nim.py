"""NVIDIA NIM TTS adapter — calls the NIM audio/speech endpoint via httpx."""

from __future__ import annotations

import base64

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseTTSAdapter, TTSResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class NvidiaNimTTSAdapter(BaseTTSAdapter):
    """Calls the NVIDIA NIM TTS endpoint and returns base64-encoded audio."""

    def __init__(self, entry: ProviderEntry) -> None:
        self._entry = entry

    async def speak(
        self,
        *,
        api_key: str,
        text: str,
        model: str | None = None,
        voice: str | None = None,
        speed: float = 1.0,
        response_format: str = "wav",
    ) -> TTSResult:
        effective_model = model or self._entry.default_model
        effective_voice = voice or self._entry.default_voice or "Magpie-Multilingual.EN-US.Aria"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": effective_model,
            "input": text,
            "voice": effective_voice,
            "response_format": response_format,
            "speed": speed,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(self._entry.base_url, json=payload, headers=headers)
                resp.raise_for_status()
                audio_bytes = resp.content
        except httpx.HTTPStatusError as exc:
            logger.error(
                "nvidia_tts_api_error", status=exc.response.status_code, model=effective_model
            )
            raise HTTPException(status_code=502, detail="TTS provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("nvidia_tts_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="TTS provider error") from exc

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(
            "tts_synthesized", model=effective_model, format=response_format, bytes=len(audio_bytes)
        )

        return TTSResult(
            audio_b64=audio_b64,
            provider_tag=f"nvidia_nim/{effective_model}",
            format=response_format,
        )
