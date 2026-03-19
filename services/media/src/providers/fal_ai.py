"""Fal.ai cloud image generation provider."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import httpx
import structlog

from .base import ImageProvider, ImageRequest, ImageResult

logger = structlog.get_logger(__name__)

FAL_QUEUE_URL = "https://queue.fal.run"

# Mapping of friendly names to fal.ai model endpoints
MODEL_ENDPOINTS: dict[str, str] = {
    "flux-pro": "fal-ai/flux-pro",
    "flux-schnell": "fal-ai/flux/schnell",
}


class FalAIProvider(ImageProvider):
    """Generate images via the Fal.ai REST API.

    Supports flux-pro and flux-schnell models. Submits jobs to the
    Fal.ai queue, polls for completion, then downloads the result.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "flux-schnell",
        output_dir: str = "/tmp/orion/media",
        poll_interval: float = 2.0,
        max_poll_attempts: int = 150,
    ) -> None:
        self._api_key = api_key or os.environ.get("FAL_API_KEY", "")
        self._model = model
        self._endpoint = MODEL_ENDPOINTS.get(model, model)
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._poll_interval = poll_interval
        self._max_poll_attempts = max_poll_attempts

    async def is_available(self) -> bool:
        """Provider is available when a valid API key is configured."""
        return bool(self._api_key)

    async def generate(self, request: ImageRequest) -> ImageResult:
        """Submit a generation job to Fal.ai, poll for result, download."""
        if not self._api_key:
            raise RuntimeError("FAL_API_KEY is not configured")

        headers = {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
        }

        payload: dict = {
            "prompt": request.prompt,
            "image_size": {
                "width": request.width,
                "height": request.height,
            },
            "num_inference_steps": request.steps,
        }
        if request.seed is not None:
            payload["seed"] = request.seed
        if request.negative_prompt:
            payload["negative_prompt"] = request.negative_prompt

        submit_url = f"{FAL_QUEUE_URL}/{self._endpoint}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Submit to queue
            resp = await client.post(submit_url, json=payload, headers=headers)
            resp.raise_for_status()
            queue_data = resp.json()

        request_id = queue_data.get("request_id")
        status_url = queue_data.get("status_url") or (
            f"{FAL_QUEUE_URL}/{self._endpoint}/requests/{request_id}/status"
        )
        response_url = queue_data.get("response_url") or (
            f"{FAL_QUEUE_URL}/{self._endpoint}/requests/{request_id}"
        )

        logger.info(
            "fal_ai_job_submitted",
            request_id=request_id,
            model=self._model,
        )

        # Poll for completion
        await self._poll_until_complete(status_url, headers)

        # Fetch result
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(response_url, headers=headers)
            resp.raise_for_status()
            result_data = resp.json()

        images = result_data.get("images", [])
        if not images:
            raise RuntimeError("Fal.ai returned no images")

        image_url = images[0].get("url", "")
        file_path = await self._download_image(image_url, request_id or "unknown")

        return ImageResult(
            file_path=str(file_path),
            provider=f"fal_ai/{self._model}",
            width=images[0].get("width", request.width),
            height=images[0].get("height", request.height),
            metadata={
                "request_id": request_id,
                "model": self._model,
                "seed": result_data.get("seed"),
            },
        )

    async def _poll_until_complete(self, status_url: str, headers: dict) -> None:
        """Poll the Fal.ai status endpoint until the job completes."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            for _ in range(self._max_poll_attempts):
                resp = await client.get(status_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                status = data.get("status")

                if status == "COMPLETED":
                    return
                if status in ("FAILED", "CANCELLED"):
                    error = data.get("error", "unknown error")
                    raise RuntimeError(f"Fal.ai job failed: {error}")

                await asyncio.sleep(self._poll_interval)

        raise RuntimeError(f"Fal.ai job timed out after {self._max_poll_attempts} polls")

    async def _download_image(self, url: str, request_id: str) -> Path:
        """Download an image from a URL and save it locally."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        # Determine extension from content-type
        content_type = resp.headers.get("content-type", "image/png")
        ext = "png" if "png" in content_type else "jpg"
        filename = f"fal_{request_id}.{ext}"
        dest = self._output_dir / filename
        dest.write_bytes(resp.content)
        logger.info("fal_ai_image_saved", path=str(dest))
        return dest
