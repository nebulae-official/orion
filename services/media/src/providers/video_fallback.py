"""Fallback video provider that tries SVD (local) first, then Fal.ai (cloud)."""

from __future__ import annotations

import structlog

from .video_base import VideoProvider, VideoRequest, VideoResult

logger = structlog.get_logger(__name__)


class FallbackVideoProvider(VideoProvider):
    """Tries video providers in priority order, falling back on failure.

    Default chain: SVD ComfyUI (local) -> Fal.ai Kling (cloud).
    """

    def __init__(self, providers: list[VideoProvider]) -> None:
        self._providers = providers

    async def generate_video(self, request: VideoRequest) -> VideoResult:
        """Attempt video generation with each provider until one succeeds."""
        errors: list[str] = []
        for provider in self._providers:
            if not await provider.is_available():
                logger.info(
                    "video_provider_unavailable",
                    provider=type(provider).__name__,
                )
                continue
            try:
                return await provider.generate_video(request)
            except Exception as e:
                logger.warning(
                    "video_provider_failed",
                    provider=type(provider).__name__,
                    error=str(e),
                )
                errors.append(f"{type(provider).__name__}: {e}")
                continue
        raise RuntimeError(
            f"All video providers failed: {'; '.join(errors) or 'none available'}"
        )

    async def is_available(self) -> bool:
        """Return True if at least one video provider is available."""
        for p in self._providers:
            if await p.is_available():
                return True
        return False
