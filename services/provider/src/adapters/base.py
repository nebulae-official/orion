"""Abstract base classes and result types for provider adapters.

An adapter receives a resolved API key and capability-specific arguments,
calls the external provider, and returns a typed result.  Adapters must
not read secrets from environment variables or the Identity service — key
resolution is the responsibility of the KeyResolver and is done before
the adapter is invoked.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class LLMResult:
    """Result returned by an LLM adapter call."""

    content: str
    model: str
    usage: dict[str, Any] | None = None


@dataclass
class ImageResult:
    """Result returned by an image generation adapter call."""

    image_b64: str
    provider_tag: str  # e.g. "nvidia_nim/black-forest-labs/flux.1-schnell"
    width: int
    height: int
    seed: int | None = None


@dataclass
class TTSResult:
    """Result returned by a TTS adapter call."""

    audio_b64: str
    provider_tag: str  # e.g. "nvidia_nim/nvidia/magpie-tts-multilingual"
    format: str


class BaseLLMAdapter(ABC):
    """Contract for LLM completion adapters."""

    @abstractmethod
    async def complete(
        self,
        *,
        api_key: str,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResult: ...


class BaseImageAdapter(ABC):
    """Contract for image generation adapters."""

    @abstractmethod
    async def generate(
        self,
        *,
        api_key: str,
        prompt: str,
        model: str | None = None,
        width: int = 1024,
        height: int = 1024,
        steps: int = 25,
        negative_prompt: str | None = None,
        seed: int | None = None,
    ) -> ImageResult: ...


class BaseTTSAdapter(ABC):
    """Contract for TTS synthesis adapters."""

    @abstractmethod
    async def speak(
        self,
        *,
        api_key: str,
        text: str,
        model: str | None = None,
        voice: str | None = None,
        speed: float = 1.0,
        response_format: str = "wav",
    ) -> TTSResult: ...
