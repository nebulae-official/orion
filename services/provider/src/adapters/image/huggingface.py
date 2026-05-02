"""HuggingFace Inference API image generation adapter."""

from __future__ import annotations

import base64

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseImageAdapter, ImageResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class HuggingFaceImageAdapter(BaseImageAdapter):
    """Calls the HuggingFace Inference API for image generation.

    Returns raw binary image bytes (JPEG/PNG) which are base64-encoded for
    the caller.  HuggingFace does not return a seed, so seed is always None.
    """

    def __init__(self, entry: ProviderEntry) -> None:
        self._entry = entry

    async def generate(
        self,
        *,
        api_key: str,
        prompt: str,
        model: str | None = None,
        width: int = 1024,
        height: int = 1024,
        steps: int = 25,
        negative_prompt: str | None = None,
        seed: int | None = None,
    ) -> ImageResult:
        effective_model = model or self._entry.default_model
        url = f"{self._entry.base_url}/models/{effective_model}"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload: dict = {
            "inputs": prompt,
            "parameters": {
                "width": width,
                "height": height,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                image_bytes = resp.content
        except httpx.HTTPStatusError as exc:
            logger.error(
                "huggingface_image_api_error",
                status=exc.response.status_code,
                model=effective_model,
            )
            raise HTTPException(status_code=502, detail="Image provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("huggingface_image_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="Image provider error") from exc

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        logger.info(
            "image_generated",
            provider="huggingface",
            model=effective_model,
            width=width,
            height=height,
        )

        return ImageResult(
            image_b64=image_b64,
            provider_tag=f"huggingface/{effective_model}",
            width=width,
            height=height,
            seed=None,  # HuggingFace Inference API does not return a seed
        )
