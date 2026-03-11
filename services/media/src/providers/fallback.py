"""Fallback provider that tries multiple providers in priority order."""

from __future__ import annotations

import structlog

from .base import ImageProvider, ImageRequest, ImageResult

logger = structlog.get_logger(__name__)


class FallbackImageProvider(ImageProvider):
    """Tries providers in priority order, falling back on failure."""

    def __init__(self, providers: list[ImageProvider]) -> None:
        self._providers = providers

    async def generate(self, request: ImageRequest) -> ImageResult:
        """Attempt generation with each provider until one succeeds."""
        errors: list[str] = []
        for provider in self._providers:
            if not await provider.is_available():
                logger.info(
                    "provider_unavailable",
                    provider=type(provider).__name__,
                )
                continue
            try:
                return await provider.generate(request)
            except Exception as e:
                logger.warning(
                    "provider_failed",
                    provider=type(provider).__name__,
                    error=str(e),
                )
                errors.append(f"{type(provider).__name__}: {e}")
                continue
        raise RuntimeError(
            f"All image providers failed: {'; '.join(errors) or 'none available'}"
        )

    async def is_available(self) -> bool:
        """Return True if at least one provider is available."""
        for p in self._providers:
            if await p.is_available():
                return True
        return False
