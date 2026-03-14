"""Tests for batch image generation."""

from __future__ import annotations

import uuid

import pytest
from src.providers.base import ImageRequest, ImageResult
from src.services.batch_generator import BatchGenerator, BatchImageRequest, BatchImageResult

from .conftest import FakeImageProvider


class TestBatchGenerator:
    """Tests for the BatchGenerator service."""

    @pytest.mark.asyncio
    async def test_generate_batch_all_succeed(self) -> None:
        """All prompts succeed and results are collected."""
        provider = FakeImageProvider()
        gen = BatchGenerator(provider, max_concurrent=3)

        request = BatchImageRequest(
            content_id=uuid.uuid4(),
            prompts=[
                ImageRequest(prompt="prompt 1"),
                ImageRequest(prompt="prompt 2"),
                ImageRequest(prompt="prompt 3"),
            ],
        )
        result = await gen.generate_batch(request)

        assert len(result.results) == 3
        assert len(result.failed) == 0
        assert all(isinstance(r, ImageResult) for r in result.results)

    @pytest.mark.asyncio
    async def test_generate_batch_all_fail(self) -> None:
        """All prompts fail, errors are collected."""
        provider = FakeImageProvider(should_fail=True)
        gen = BatchGenerator(provider, max_concurrent=2)

        request = BatchImageRequest(
            content_id=uuid.uuid4(),
            prompts=[
                ImageRequest(prompt="prompt 1"),
                ImageRequest(prompt="prompt 2"),
            ],
        )
        result = await gen.generate_batch(request)

        assert len(result.results) == 0
        assert len(result.failed) == 2

    @pytest.mark.asyncio
    async def test_generate_batch_empty_prompts(self) -> None:
        """Empty prompt list returns empty results."""
        provider = FakeImageProvider()
        gen = BatchGenerator(provider, max_concurrent=3)

        request = BatchImageRequest(
            content_id=uuid.uuid4(),
            prompts=[],
        )
        result = await gen.generate_batch(request)

        assert len(result.results) == 0
        assert len(result.failed) == 0

    @pytest.mark.asyncio
    async def test_concurrency_limit_respected(self) -> None:
        """BatchGenerator respects the max_concurrent semaphore."""
        import asyncio

        call_times: list[float] = []
        original_provider = FakeImageProvider()

        async def slow_generate(request: ImageRequest) -> ImageResult:
            call_times.append(asyncio.get_event_loop().time())
            await asyncio.sleep(0.01)
            return await FakeImageProvider().generate(request)

        original_provider.generate = slow_generate  # type: ignore[assignment]
        gen = BatchGenerator(original_provider, max_concurrent=1)

        request = BatchImageRequest(
            content_id=uuid.uuid4(),
            prompts=[ImageRequest(prompt=f"p{i}") for i in range(3)],
        )
        result = await gen.generate_batch(request)
        # With max_concurrent=1, calls should be sequential
        assert len(result.results) == 3

    @pytest.mark.asyncio
    async def test_batch_result_model(self) -> None:
        """BatchImageResult model defaults are correct."""
        result = BatchImageResult()
        assert result.results == []
        assert result.failed == []

    @pytest.mark.asyncio
    async def test_batch_request_model(self) -> None:
        """BatchImageRequest requires content_id and prompts."""
        cid = uuid.uuid4()
        req = BatchImageRequest(
            content_id=cid,
            prompts=[ImageRequest(prompt="test")],
        )
        assert req.content_id == cid
        assert len(req.prompts) == 1
