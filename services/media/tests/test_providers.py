"""Tests for Media service image providers (mocked)."""

from __future__ import annotations

import pytest
from src.providers.base import ImageProvider, ImageRequest, ImageResult
from src.providers.fallback import FallbackImageProvider


class MockProvider(ImageProvider):
    """A simple mock provider for testing the fallback chain."""

    def __init__(self, name: str, available: bool = True, fail_generate: bool = False) -> None:
        self._name = name
        self._available = available
        self._fail_generate = fail_generate

    async def generate(self, request: ImageRequest) -> ImageResult:
        if self._fail_generate:
            raise RuntimeError(f"{self._name} generation failed")
        return ImageResult(
            file_path=f"/tmp/{self._name}_output.png",
            provider=self._name,
            width=request.width,
            height=request.height,
        )

    async def is_available(self) -> bool:
        return self._available


class TestFallbackImageProvider:
    """Tests for the FallbackImageProvider strategy."""

    @pytest.mark.asyncio
    async def test_uses_first_available_provider(self) -> None:
        """Fallback provider uses the first available provider."""
        p1 = MockProvider("comfyui")
        p2 = MockProvider("fal_ai")
        fallback = FallbackImageProvider([p1, p2])

        result = await fallback.generate(ImageRequest(prompt="test"))
        assert result.provider == "comfyui"

    @pytest.mark.asyncio
    async def test_falls_back_on_failure(self) -> None:
        """When first provider fails, fallback tries the next."""
        p1 = MockProvider("comfyui", fail_generate=True)
        p2 = MockProvider("fal_ai")
        fallback = FallbackImageProvider([p1, p2])

        result = await fallback.generate(ImageRequest(prompt="test"))
        assert result.provider == "fal_ai"

    @pytest.mark.asyncio
    async def test_all_providers_fail_raises(self) -> None:
        """When all providers fail, a RuntimeError is raised."""
        p1 = MockProvider("comfyui", fail_generate=True)
        p2 = MockProvider("fal_ai", fail_generate=True)
        fallback = FallbackImageProvider([p1, p2])

        with pytest.raises(RuntimeError):
            await fallback.generate(ImageRequest(prompt="test"))

    @pytest.mark.asyncio
    async def test_is_available_any_provider(self) -> None:
        """is_available returns True if any child provider is available."""
        p1 = MockProvider("comfyui", available=False)
        p2 = MockProvider("fal_ai", available=True)
        fallback = FallbackImageProvider([p1, p2])

        assert await fallback.is_available() is True

    @pytest.mark.asyncio
    async def test_is_available_none_available(self) -> None:
        """is_available returns False when no providers are available."""
        p1 = MockProvider("comfyui", available=False)
        p2 = MockProvider("fal_ai", available=False)
        fallback = FallbackImageProvider([p1, p2])

        assert await fallback.is_available() is False


class TestImageRequest:
    """Tests for ImageRequest model validation."""

    def test_defaults(self) -> None:
        req = ImageRequest(prompt="test")
        assert req.width == 1024
        assert req.height == 1024
        assert req.steps == 20
        assert req.cfg_scale == 7.0
        assert req.seed is None

    def test_custom_values(self) -> None:
        req = ImageRequest(
            prompt="test",
            negative_prompt="blurry",
            width=512,
            height=768,
            steps=30,
            cfg_scale=9.0,
            seed=42,
        )
        assert req.negative_prompt == "blurry"
        assert req.seed == 42
