"""Batch image generation with concurrency control."""

from __future__ import annotations

import asyncio
import uuid

import structlog
from pydantic import BaseModel, Field

from ..providers.base import ImageProvider, ImageRequest, ImageResult

logger = structlog.get_logger(__name__)


class BatchImageRequest(BaseModel):
    """A batch of image generation requests for a single content piece."""

    content_id: uuid.UUID
    prompts: list[ImageRequest]


class BatchImageResult(BaseModel):
    """Aggregated results of a batch generation run."""

    results: list[ImageResult] = Field(default_factory=list)
    failed: list[str] = Field(default_factory=list)


class BatchGenerator:
    """Generate multiple images concurrently with a concurrency limit."""

    def __init__(self, provider: ImageProvider, max_concurrent: int = 3) -> None:
        self._provider = provider
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def generate_batch(self, request: BatchImageRequest) -> BatchImageResult:
        """Process all prompts in parallel (up to max_concurrent).

        Individual failures are collected rather than aborting the batch.
        """
        tasks = [self._generate_one(idx, img_req) for idx, img_req in enumerate(request.prompts)]
        outcomes = await asyncio.gather(*tasks, return_exceptions=False)

        results: list[ImageResult] = []
        failed: list[str] = []
        for outcome in outcomes:
            if isinstance(outcome, ImageResult):
                results.append(outcome)
            else:
                failed.append(str(outcome))

        logger.info(
            "batch_complete",
            content_id=str(request.content_id),
            total=len(request.prompts),
            succeeded=len(results),
            failed_count=len(failed),
        )

        return BatchImageResult(results=results, failed=failed)

    async def _generate_one(self, idx: int, request: ImageRequest) -> ImageResult | str:
        """Generate a single image within the semaphore limit."""
        async with self._semaphore:
            try:
                result = await self._provider.generate(request)
                logger.info("batch_item_success", index=idx)
                return result
            except Exception as e:
                logger.warning(
                    "batch_item_failed",
                    index=idx,
                    error=str(e),
                )
                return f"Prompt {idx}: {e}"
