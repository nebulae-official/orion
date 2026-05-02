"""FishSpeech TTS adapter — calls a self-hosted FishSpeech HTTP API."""

from __future__ import annotations

import base64

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseTTSAdapter, TTSResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class FishSpeechTTSAdapter(BaseTTSAdapter):
    """Calls a local FishSpeech HTTP server for offline TTS synthesis.

    The api_key parameter doubles as the server base URL so that Identity can
    store the FishSpeech endpoint without a dedicated field.  If api_key is
    empty, the catalog entry's base_url is used instead.
    """

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
        # api_key carries the server URL for local deployments; fall back to catalog entry.
        base_url = api_key.strip() or self._entry.base_url
        url = f"{base_url}/v1/tts"

        payload: dict = {
            "text": text,
            "format": response_format,
            "speed": speed,
        }
        effective_voice = voice or self._entry.default_voice
        if effective_voice:
            payload["speaker"] = effective_voice

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                audio_bytes = resp.content
        except httpx.HTTPStatusError as exc:
            logger.error(
                "fish_speech_api_error",
                status=exc.response.status_code,
                model=effective_model,
            )
            raise HTTPException(status_code=502, detail="TTS provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("fish_speech_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="TTS provider error") from exc

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(
            "tts_synthesized",
            provider="fish_speech",
            model=effective_model,
            format=response_format,
            bytes=len(audio_bytes),
        )

        return TTSResult(
            audio_b64=audio_b64,
            provider_tag=f"fish_speech/{effective_model or 'default'}",
            format=response_format,
        )
