"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod

from pydantic import BaseModel


class LLMResponse(BaseModel):
    """Standardised response from any LLM provider."""

    content: str
    model: str
    usage: dict | None = None


class LLMProvider(ABC):
    """Contract that every LLM backend must implement."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Send a prompt to the LLM and return the response."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Return True when the provider is reachable and ready."""
        ...
