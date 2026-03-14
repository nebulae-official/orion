"""Image and video generation providers for the Orion Media service."""

from .base import ImageProvider, ImageRequest, ImageResult
from .comfyui import ComfyUIProvider
from .factory import get_image_provider
from .fal_ai import FalAIProvider
from .fallback import FallbackImageProvider
from .svd_comfyui import SVDProvider
from .video_base import VideoProvider, VideoRequest, VideoResult
from .video_factory import get_video_provider
from .video_fal import FalVideoProvider
from .video_fallback import FallbackVideoProvider

__all__ = [
    "ImageProvider",
    "ImageRequest",
    "ImageResult",
    "ComfyUIProvider",
    "FalAIProvider",
    "FallbackImageProvider",
    "get_image_provider",
    "VideoProvider",
    "VideoRequest",
    "VideoResult",
    "SVDProvider",
    "FalVideoProvider",
    "FallbackVideoProvider",
    "get_video_provider",
]
