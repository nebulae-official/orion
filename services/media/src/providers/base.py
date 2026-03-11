"""Abstract base classes for image generation providers."""

from abc import ABC, abstractmethod

from pydantic import BaseModel


class ImageRequest(BaseModel):
    """Parameters for a single image generation request."""

    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    steps: int = 20
    cfg_scale: float = 7.0
    seed: int | None = None


class ImageResult(BaseModel):
    """Result of a successful image generation."""

    file_path: str
    provider: str
    width: int
    height: int
    metadata: dict | None = None


class ImageProvider(ABC):
    """Abstract interface that all image generation providers must implement."""

    @abstractmethod
    async def generate(self, request: ImageRequest) -> ImageResult:
        """Generate an image from the given request parameters."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Return True if this provider is currently usable."""
        ...
