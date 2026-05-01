from __future__ import annotations

import os

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import ImageGenerateRequest, ImageGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/image", tags=["image"])

_IMAGE_MODEL = os.getenv("PROVIDER_IMAGE_MODEL", "black-forest-labs/flux.1-schnell")
_IMAGE_BASE_URL = os.getenv("PROVIDER_IMAGE_BASE_URL", "https://ai.api.nvidia.com/v1/genai")


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(body: ImageGenerateRequest, request: Request) -> ImageGenerateResponse:
    model = body.model or _IMAGE_MODEL
    url = f"{_IMAGE_BASE_URL}/{model}"

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload: dict = {
        "prompt": body.prompt,
        "width": body.width,
        "height": body.height,
        "num_inference_steps": body.steps,
    }
    if body.negative_prompt is not None:
        payload["negative_prompt"] = body.negative_prompt
    if body.seed is not None:
        payload["seed"] = body.seed

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("nvidia_image_api_error", status=exc.response.status_code, model=model)
        raise HTTPException(status_code=502, detail="Image provider error") from exc
    except Exception as exc:  # network errors, timeouts, etc.
        logger.error("nvidia_image_request_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="Image provider error") from exc

    artifacts = data.get("artifacts", [])
    if not artifacts:
        logger.error("nvidia_image_no_artifacts", model=model, response=data)
        raise HTTPException(status_code=502, detail="Image provider returned no artifacts")

    artifact = artifacts[0]
    image_b64: str = artifact["base64"]
    seed: int | None = artifact.get("seed")

    logger.info("image_generated", model=model, width=body.width, height=body.height)

    return ImageGenerateResponse(
        image_b64=image_b64,
        provider=f"nvidia_nim/{model}",
        width=body.width,
        height=body.height,
        seed=seed,
    )
