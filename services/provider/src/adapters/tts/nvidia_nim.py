"""NVIDIA Riva gRPC TTS adapter — calls hosted Magpie TTS via NVCF."""

from __future__ import annotations

import asyncio
import base64
import io
import os
import wave

try:
    import riva.client
except ModuleNotFoundError as _err:
    raise ModuleNotFoundError(
        "nvidia-riva-client is required for the NVIDIA NIM TTS adapter. "
        "Install it with: pip install nvidia-riva-client"
    ) from _err

import structlog
from fastapi import HTTPException

from src.adapters.base import BaseTTSAdapter, TTSResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)

# NVCF function routing ID for the hosted Magpie TTS model.
# Overridable via env var for staging/canary deployments.
_NVCF_FUNCTION_ID = os.getenv("PROVIDER_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
_SAMPLE_RATE = 44100
_LANGUAGE_CODE = "en-US"


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = _SAMPLE_RATE) -> bytes:
    """Wrap raw LINEAR_PCM bytes in a WAV container (16-bit mono)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit PCM → 2 bytes per sample
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


class NvidiaNimTTSAdapter(BaseTTSAdapter):
    """Calls the NVIDIA Riva hosted TTS (Magpie) service via gRPC over NVCF."""

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

        def _synthesize() -> bytes:
            # Metadata carries auth + NVCF routing; never logged.
            auth = riva.client.Auth(
                uri=self._entry.base_url,
                use_ssl=True,
                metadata_args=[
                    ["authorization", f"Bearer {api_key}"],
                    ["function-id", _NVCF_FUNCTION_ID],
                ],
            )
            tts_service = riva.client.SpeechSynthesisService(auth)
            # Voice name omitted — hosted Magpie may reject specific names;
            # let the server use its default voice.
            resp = tts_service.synthesize(
                text=text,
                language_code=_LANGUAGE_CODE,
                sample_rate_hz=_SAMPLE_RATE,
            )
            return bytes(resp.audio)

        try:
            pcm_bytes = await asyncio.to_thread(_synthesize)
        except Exception as exc:  # riva raises heterogeneous grpc.RpcError subtypes
            logger.error(
                "nvidia_tts_riva_failed",
                model=effective_model,
                error=type(exc).__name__,
            )
            raise HTTPException(status_code=502, detail="TTS provider error") from exc

        audio_bytes = _pcm_to_wav(pcm_bytes) if response_format == "wav" else pcm_bytes
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(
            "tts_synthesized",
            model=effective_model,
            format=response_format,
            bytes=len(audio_bytes),
        )

        return TTSResult(
            audio_b64=audio_b64,
            provider_tag=f"nvidia_nim/{effective_model}",
            format=response_format,
        )
