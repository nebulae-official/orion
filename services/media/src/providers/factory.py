"""Factory for constructing the image provider stack."""

from __future__ import annotations

import structlog

from .base import ImageProvider
from .provider_client import ProviderServiceImageClient

# Legacy providers kept for reference — not imported or constructed.
# from .comfyui import ComfyUIProvider
# from .fal_ai import FalAIProvider
# from .fallback import FallbackImageProvider

logger = structlog.get_logger(__name__)


def get_image_provider(
    settings=None,  # noqa: ARG001 — kept for API compatibility with callers
    user_preferences: dict[str, str] | None = None,  # noqa: ARG001
) -> ImageProvider:
    """Return the Provider Service image client.

    All image generation is now routed through the centralised Provider Service
    (ORION-246).  Legacy ComfyUI / Fal.ai construction has been removed.
    """
    logger.info("image_provider_selected", provider="provider_service")
    return ProviderServiceImageClient()
