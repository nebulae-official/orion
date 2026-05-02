from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Request

from src.adapters.base import BaseImageAdapter
from src.adapters.image.nvidia_nim import NvidiaNimImageAdapter
from src.catalog import Capability, get_entry
from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import ImageGenerateRequest, ImageGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/image", tags=["image"])

_DEFAULT_PROVIDER = "nvidia_nim"

_IMAGE_ADAPTERS: dict[str, type[BaseImageAdapter]] = {
    "nvidia_nim": NvidiaNimImageAdapter,
}


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(body: ImageGenerateRequest, request: Request) -> ImageGenerateResponse:
    provider_name = body.provider or _DEFAULT_PROVIDER
    try:
        entry = get_entry(Capability.IMAGE, provider_name)
    except KeyError:
        raise HTTPException(status_code=422, detail=f"Unknown provider: '{provider_name}'")

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"), provider_name)
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    adapter_cls = _IMAGE_ADAPTERS.get(provider_name)
    if adapter_cls is None:
        raise HTTPException(
            status_code=422, detail=f"No adapter registered for provider '{provider_name}'"
        )
    adapter = adapter_cls(entry)
    result = await adapter.generate(
        api_key=api_key,
        prompt=body.prompt,
        model=body.model,
        width=body.width,
        height=body.height,
        steps=body.steps,
        negative_prompt=body.negative_prompt,
        seed=body.seed,
    )

    return ImageGenerateResponse(
        image_b64=result.image_b64,
        provider=result.provider_tag,
        width=result.width,
        height=result.height,
        seed=result.seed,
    )
