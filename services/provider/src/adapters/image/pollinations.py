"""Pollinations.ai image generation adapter — free, no-auth GET endpoint."""

from __future__ import annotations

import base64
import urllib.parse

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseImageAdapter, ImageResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class PollinationsImageAdapter(BaseImageAdapter):
    """Calls the Pollinations.ai free image generation API (no API key required).

    Encodes the prompt in the URL path and passes dimensions/model as query
    params.  The response is raw JPEG binary which is base64-encoded for the
    caller.  The api_key parameter is accepted but silently ignored.
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
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"{self._entry.base_url}/prompt/{encoded_prompt}"

        params: dict = {
            "width": width,
            "height": height,
            "model": effective_model,
            "nologo": "true",
        }
        if seed is not None:
            params["seed"] = seed

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                image_bytes = resp.content
        except httpx.HTTPStatusError as exc:
            logger.error(
                "pollinations_image_api_error",
                status=exc.response.status_code,
                model=effective_model,
            )
            raise HTTPException(status_code=502, detail="Image provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("pollinations_image_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="Image provider error") from exc

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        logger.info(
            "image_generated",
            provider="pollinations",
            model=effective_model,
            width=width,
            height=height,
        )

        return ImageResult(
            image_b64=image_b64,
            provider_tag=f"pollinations/{effective_model}",
            width=width,
            height=height,
            seed=seed,
        )
