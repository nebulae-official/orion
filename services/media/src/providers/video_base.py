"""Abstract base classes for video generation providers."""

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class VideoRequest(BaseModel):
    """Parameters for a video generation request from a source image."""

    image_path: str
    motion_bucket_id: int = Field(default=127, ge=1, le=255)
    seed: int | None = None
    fps: int = Field(default=8, ge=1, le=30)
    duration_seconds: float = Field(default=3.0, ge=1.0, le=10.0)
    width: int = 1080
    height: int = 1920


class VideoResult(BaseModel):
    """Result of a successful video generation."""

    file_path: str
    provider: str
    width: int
    height: int
    duration_seconds: float
    metadata: dict | None = None


class VideoProvider(ABC):
    """Abstract interface that all video generation providers must implement."""

    @abstractmethod
    async def generate_video(self, request: VideoRequest) -> VideoResult:
        """Generate a video clip from the given source image and parameters."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Return True if this provider is currently usable."""
        ...
