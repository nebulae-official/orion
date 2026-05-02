"""NVIDIA NIM image generation adapter — calls the NIM GenAI image API via httpx."""

from __future__ import annotations

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseImageAdapter, ImageResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class NvidiaNimImageAdapter(BaseImageAdapter):
    """Calls the NVIDIA NIM image generation endpoint."""

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
        url = f"{self._entry.base_url}/{effective_model}"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload: dict = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "steps": steps,
        }
        if negative_prompt is not None:
            payload["negative_prompt"] = negative_prompt
        if seed is not None:
            payload["seed"] = seed

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "nvidia_image_api_error", status=exc.response.status_code, model=effective_model
            )
            raise HTTPException(status_code=502, detail="Image provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("nvidia_image_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="Image provider error") from exc

        artifacts = data.get("artifacts", [])
        if not artifacts:
            logger.error("nvidia_image_no_artifacts", model=effective_model, response=data)
            raise HTTPException(status_code=502, detail="Image provider returned no artifacts")

        artifact = artifacts[0]
        image_b64: str = artifact["base64"]
        result_seed: int | None = artifact.get("seed")

        logger.info("image_generated", model=effective_model, width=width, height=height)

        return ImageResult(
            image_b64=image_b64,
            provider_tag=f"nvidia_nim/{effective_model}",
            width=width,
            height=height,
            seed=result_seed,
        )
