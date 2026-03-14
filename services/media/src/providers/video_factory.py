"""Factory for constructing the video provider stack."""

from __future__ import annotations

import os

import structlog
from orion_common.config import CommonSettings

from .svd_comfyui import SVDProvider
from .video_base import VideoProvider
from .video_fal import FalVideoProvider
from .video_fallback import FallbackVideoProvider

logger = structlog.get_logger(__name__)


def get_video_provider(settings: CommonSettings) -> VideoProvider:
    """Build the video provider chain based on current configuration.

    Default priority: SVD ComfyUI (local) first, then Fal.ai Kling (cloud).
    The order can be controlled via the VIDEO_PROVIDER_PRIORITY env var
    (comma-separated, e.g. ``fal_ai,svd_comfyui``).
    """
    output_dir = os.environ.get("MEDIA_VIDEO_OUTPUT_DIR", "/tmp/orion/media/video")

    svd = SVDProvider(host=settings.comfyui_host, output_dir=output_dir)
    fal = FalVideoProvider(
        api_key=os.environ.get("FAL_API_KEY", ""),
        output_dir=output_dir,
    )

    priority_str = os.environ.get("VIDEO_PROVIDER_PRIORITY", "svd_comfyui,fal_ai")
    priority = [p.strip() for p in priority_str.split(",")]

    provider_map: dict[str, VideoProvider] = {
        "svd_comfyui": svd,
        "fal_ai": fal,
    }

    ordered: list[VideoProvider] = []
    for name in priority:
        if name in provider_map:
            ordered.append(provider_map[name])
        else:
            logger.warning("unknown_video_provider_in_priority", name=name)

    # Include any providers not mentioned in the priority list
    for name, provider in provider_map.items():
        if provider not in ordered:
            ordered.append(provider)

    logger.info(
        "video_provider_chain",
        order=[type(p).__name__ for p in ordered],
    )

    return FallbackVideoProvider(providers=ordered)
