"""Provider Service image client — delegates image generation to the centralized provider service."""

from __future__ import annotations

import base64
import os
from pathlib import Path
from uuid import uuid4

import httpx
import structlog

from .base import ImageProvider, ImageRequest, ImageResult

logger = structlog.get_logger(__name__)


class ProviderServiceImageClient(ImageProvider):
    """Generate images by calling the Orion Provider Service REST API.

    The provider service handles NVIDIA NIM credentials and model routing;
    this client is credential-free and only needs PROVIDER_URL.
    """

    def __init__(self, output_dir: str | None = None) -> None:
        self._provider_url = os.environ.get("PROVIDER_URL", "http://provider:8008").rstrip("/")
        self._output_dir = Path(
            output_dir or os.environ.get("MEDIA_OUTPUT_DIR", "/tmp/orion/media")
        )
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def generate(self, request: ImageRequest) -> ImageResult:
        payload = {
            "prompt": request.prompt,
            "width": request.width,
            "height": request.height,
            "steps": request.steps,
        }
        if request.negative_prompt:
            payload["negative_prompt"] = request.negative_prompt
        if request.seed is not None:
            payload["seed"] = request.seed

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self._provider_url}/api/v1/image/generate",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # provider service unreachable or returned an error
            logger.error("provider_image_request_failed", error=str(exc))
            raise

        image_bytes = base64.b64decode(data["image_b64"])
        dest = self._output_dir / f"provider_{uuid4().hex}.png"
        dest.write_bytes(image_bytes)

        logger.info("image_saved", path=str(dest), provider=data.get("provider"))

        return ImageResult(
            file_path=str(dest),
            provider=data.get("provider", "nvidia_nim/flux.1-schnell"),
            width=data.get("width", request.width),
            height=data.get("height", request.height),
            metadata={"seed": data.get("seed")},
        )

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._provider_url}/health")
                return resp.status_code == 200
        except Exception:  # provider unreachable — treat as unavailable
            return False
