"""Fal.ai cloud video generation provider using Kling v1.5 model."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import httpx
import structlog

from .video_base import VideoProvider, VideoRequest, VideoResult

logger = structlog.get_logger(__name__)

FAL_QUEUE_URL = "https://queue.fal.run"

# Kling v1.5 image-to-video endpoint on Fal.ai
KLING_ENDPOINT = "fal-ai/kling-video/v1.5/standard/image-to-video"

# Approximate cost per 5-second clip
COST_PER_CLIP_USD = 0.10


class FalVideoProvider(VideoProvider):
    """Generate video clips via the Fal.ai REST API using Kling v1.5.

    Submits image-to-video jobs to the Fal.ai queue, polls for completion,
    then downloads the result.  Tracks estimated cost per generation.
    """

    def __init__(
        self,
        api_key: str | None = None,
        output_dir: str = "/tmp/orion/media/video",
        poll_interval: float = 3.0,
        max_poll_attempts: int = 200,
    ) -> None:
        self._api_key = api_key or os.environ.get("FAL_API_KEY", "")
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._poll_interval = poll_interval
        self._max_poll_attempts = max_poll_attempts
        self._total_cost_usd: float = 0.0

    @property
    def total_cost_usd(self) -> float:
        """Cumulative cost of all video generations in this session."""
        return self._total_cost_usd

    async def is_available(self) -> bool:
        """Provider is available when a valid API key is configured."""
        return bool(self._api_key)

    async def generate_video(self, request: VideoRequest) -> VideoResult:
        """Submit an image-to-video job to Fal.ai, poll for result, download."""
        if not self._api_key:
            raise RuntimeError("FAL_API_KEY is not configured")

        headers = {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
        }

        payload: dict = {
            "image_url": request.image_path,
            "duration": "5",
            "aspect_ratio": f"{request.width}:{request.height}",
        }
        if request.seed is not None:
            payload["seed"] = request.seed

        submit_url = f"{FAL_QUEUE_URL}/{KLING_ENDPOINT}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(submit_url, json=payload, headers=headers)
            resp.raise_for_status()
            queue_data = resp.json()

        request_id = queue_data.get("request_id")
        status_url = queue_data.get("status_url") or (
            f"{FAL_QUEUE_URL}/{KLING_ENDPOINT}/requests/{request_id}/status"
        )
        response_url = queue_data.get("response_url") or (
            f"{FAL_QUEUE_URL}/{KLING_ENDPOINT}/requests/{request_id}"
        )

        logger.info(
            "fal_video_job_submitted",
            request_id=request_id,
            model="kling-v1.5",
        )

        await self._poll_until_complete(status_url, headers)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(response_url, headers=headers)
            resp.raise_for_status()
            result_data = resp.json()

        video_url = result_data.get("video", {}).get("url", "")
        if not video_url:
            raise RuntimeError("Fal.ai Kling returned no video URL")

        file_path = await self._download_video(video_url, request_id or "unknown")

        # Track cost
        self._total_cost_usd += COST_PER_CLIP_USD

        return VideoResult(
            file_path=str(file_path),
            provider="fal_ai/kling-v1.5",
            width=request.width,
            height=request.height,
            duration_seconds=5.0,
            metadata={
                "request_id": request_id,
                "model": "kling-v1.5",
                "cost_usd": COST_PER_CLIP_USD,
                "cumulative_cost_usd": self._total_cost_usd,
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
                    raise RuntimeError(f"Fal.ai video job failed: {error}")

                await asyncio.sleep(self._poll_interval)

        raise RuntimeError(
            f"Fal.ai video job timed out after {self._max_poll_attempts} polls"
        )

    async def _download_video(self, url: str, request_id: str) -> Path:
        """Download a video from a URL and save it locally."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        filename = f"fal_kling_{request_id}.mp4"
        dest = self._output_dir / filename
        dest.write_bytes(resp.content)
        logger.info("fal_video_saved", path=str(dest))
        return dest
