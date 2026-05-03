"""Microsoft Edge TTS adapter — free, no-auth streaming TTS."""

from __future__ import annotations

import base64

import edge_tts
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseTTSAdapter, TTSResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class EdgeTTSAdapter(BaseTTSAdapter):
    """Calls Microsoft Edge's TTS endpoint via the edge-tts library.

    No API key required.  Output is MP3.  The ``api_key`` parameter is
    accepted but silently ignored to satisfy the BaseTTSAdapter contract.
    """

    def __init__(self, entry: ProviderEntry) -> None:
        self._entry = entry

    async def speak(
        self,
        *,
        api_key: str,  # noqa: ARG002 — keyless adapter; accepted for interface compatibility
        text: str,
        model: str | None = None,  # noqa: ARG002 — edge-tts has no model concept
        voice: str | None = None,
        speed: float = 1.0,
        response_format: str = "mp3",  # noqa: ARG002 — edge-tts only emits mp3
    ) -> TTSResult:
        effective_voice = voice or self._entry.default_voice or "en-US-AriaNeural"
        # edge-tts speed is expressed as a percentage delta string (e.g. "+10%", "-5%")
        rate_pct = int(round((speed - 1.0) * 100))
        rate_str = f"{rate_pct:+d}%"

        try:
            communicate = edge_tts.Communicate(text=text, voice=effective_voice, rate=rate_str)
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]
        except Exception as exc:  # edge-tts wraps WebSocket / network errors heterogeneously
            logger.error("edge_tts_request_failed", voice=effective_voice, error=str(exc))
            raise HTTPException(status_code=502, detail="TTS provider error") from exc

        if not audio_bytes:
            logger.error("edge_tts_empty_response", voice=effective_voice)
            raise HTTPException(status_code=502, detail="TTS provider returned empty audio")

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(
            "tts_generated",
            provider="edge_tts",
            voice=effective_voice,
            byte_count=len(audio_bytes),
        )

        return TTSResult(
            audio_b64=audio_b64,
            provider_tag=f"edge_tts/{effective_voice}",
            format="mp3",
        )
