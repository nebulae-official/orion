from __future__ import annotations

import base64
import os

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import TTSGenerateRequest, TTSGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])

_TTS_MODEL = os.getenv("PROVIDER_TTS_MODEL", "nvidia/magpie-tts-multilingual")
_TTS_BASE_URL = "https://integrate.api.nvidia.com/v1/audio/speech"


@router.post("/speak", response_model=TTSGenerateResponse)
async def speak(body: TTSGenerateRequest, request: Request) -> TTSGenerateResponse:
    model = body.model or _TTS_MODEL

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "input": body.text,
        "voice": body.voice,
        "response_format": body.response_format,
        "speed": body.speed,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(_TTS_BASE_URL, json=payload, headers=headers)
            resp.raise_for_status()
            audio_bytes = resp.content
    except httpx.HTTPStatusError as exc:
        logger.error("nvidia_tts_api_error", status=exc.response.status_code, model=model)
        raise HTTPException(status_code=502, detail="TTS provider error") from exc
    except Exception as exc:  # network errors, timeouts, etc.
        logger.error("nvidia_tts_request_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="TTS provider error") from exc

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    logger.info("tts_synthesized", model=model, format=body.response_format, bytes=len(audio_bytes))

    return TTSGenerateResponse(
        audio_b64=audio_b64,
        provider=f"nvidia_nim/{model}",
        format=body.response_format,
    )
