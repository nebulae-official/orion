from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Request

from src.adapters.base import BaseTTSAdapter
from src.adapters.tts.nvidia_nim import NvidiaNimTTSAdapter
from src.catalog import Capability, get_entry
from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import TTSGenerateRequest, TTSGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])

_DEFAULT_PROVIDER = "nvidia_nim"

_TTS_ADAPTERS: dict[str, type[BaseTTSAdapter]] = {
    "nvidia_nim": NvidiaNimTTSAdapter,
}


@router.post("/speak", response_model=TTSGenerateResponse)
async def speak(body: TTSGenerateRequest, request: Request) -> TTSGenerateResponse:
    provider_name = body.provider or _DEFAULT_PROVIDER
    try:
        entry = get_entry(Capability.TTS, provider_name)
    except KeyError:
        raise HTTPException(status_code=422, detail=f"Unknown provider: '{provider_name}'")

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"), provider_name)
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    adapter_cls = _TTS_ADAPTERS.get(provider_name)
    if adapter_cls is None:
        raise HTTPException(
            status_code=422, detail=f"No adapter registered for provider '{provider_name}'"
        )
    adapter = adapter_cls(entry)
    result = await adapter.speak(
        api_key=api_key,
        text=body.text,
        model=body.model,
        voice=body.voice,
        speed=body.speed,
        response_format=body.response_format,
    )

    return TTSGenerateResponse(
        audio_b64=result.audio_b64,
        provider=result.provider_tag,
        format=result.format,
    )
