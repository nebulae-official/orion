"""Factory for constructing the image provider stack."""

from __future__ import annotations

import os

import structlog
from orion_common.config import CommonSettings

from .base import ImageProvider
from .comfyui import ComfyUIProvider
from .fal_ai import FalAIProvider
from .fallback import FallbackImageProvider

logger = structlog.get_logger(__name__)


def get_image_provider(
    settings: CommonSettings,
    user_preferences: dict[str, str] | None = None,
) -> ImageProvider:
    """Build the provider chain based on current configuration.

    If *user_preferences* contains ``image_provider``, that provider is
    tried first before the default priority chain.

    Default priority: ComfyUI (local) first, then Fal.ai (cloud).
    The order can be controlled via the MEDIA_PROVIDER_PRIORITY env var
    (comma-separated, e.g. ``fal_ai,comfyui``).
    """
    prefs = user_preferences or {}
    output_dir = os.environ.get("MEDIA_OUTPUT_DIR", "/tmp/orion/media")

    comfyui = ComfyUIProvider(host=settings.comfyui_host, output_dir=output_dir)
    fal_ai = FalAIProvider(
        api_key=os.environ.get("FAL_API_KEY", ""),
        model=prefs.get("image_model", os.environ.get("FAL_MODEL", "flux-schnell")),
        output_dir=output_dir,
    )

    # If user has a preferred image provider, put it first
    user_pref_provider = prefs.get("image_provider")

    if user_pref_provider:
        default_priority = os.environ.get("MEDIA_PROVIDER_PRIORITY", "comfyui,fal_ai")
        priority_str = f"{user_pref_provider},{default_priority}"
    else:
        priority_str = os.environ.get("MEDIA_PROVIDER_PRIORITY", "comfyui,fal_ai")

    priority = [p.strip() for p in priority_str.split(",")]

    provider_map: dict[str, ImageProvider] = {
        "comfyui": comfyui,
        "fal_ai": fal_ai,
    }

    ordered: list[ImageProvider] = []
    seen: set[str] = set()
    for name in priority:
        if name in provider_map and name not in seen:
            ordered.append(provider_map[name])
            seen.add(name)
        elif name not in provider_map:
            logger.warning("unknown_provider_in_priority", name=name)

    # Include any providers not mentioned in the priority list
    for name, provider in provider_map.items():
        if name not in seen:
            ordered.append(provider)

    logger.info(
        "image_provider_chain",
        order=[type(p).__name__ for p in ordered],
        source="user_pref" if user_pref_provider else "env",
    )

    return FallbackImageProvider(providers=ordered)
