"""Abstract base class for social media providers."""

from __future__ import annotations

from abc import ABC, abstractmethod

from src.schemas import PublishResult


class PublishContent:
    """Content data needed by a social provider to publish."""

    def __init__(
        self,
        text: str,
        media_paths: list[str] | None = None,
        hashtags: list[str] | None = None,
    ) -> None:
        self.text = text
        self.media_paths = media_paths or []
        self.hashtags = hashtags or []


class SocialProvider(ABC):
    """Strategy interface for social media platform integrations."""

    @abstractmethod
    async def publish(self, content: PublishContent) -> PublishResult:
        """Publish content to the platform."""

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Check if stored credentials are valid."""

    @abstractmethod
    def get_character_limit(self) -> int:
        """Return the platform's character limit for posts."""

    @abstractmethod
    def get_platform_name(self) -> str:
        """Return the platform identifier string."""
