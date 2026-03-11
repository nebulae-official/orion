"""Abstract base class for text-to-speech providers."""

from abc import ABC, abstractmethod

from pydantic import BaseModel


class TTSRequest(BaseModel):
    """Request parameters for TTS synthesis."""

    text: str
    voice_id: str = "default"
    speed: float = 1.0
    output_format: str = "mp3"


class TTSResult(BaseModel):
    """Result of a TTS synthesis operation."""

    file_path: str
    duration_seconds: float
    provider: str


class TTSProvider(ABC):
    """Abstract interface for text-to-speech providers."""

    @abstractmethod
    async def synthesize(self, request: TTSRequest) -> TTSResult:
        """Synthesize speech from text and return the result."""
        ...

    @abstractmethod
    async def list_voices(self) -> list[dict]:
        """List available voices from the provider."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check whether the provider is configured and reachable."""
        ...
