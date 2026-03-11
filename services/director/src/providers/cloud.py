"""Cloud LLM provider — OpenAI-compatible API (DeepSeek, OpenAI, etc.)."""

from __future__ import annotations

import os

import httpx
import structlog

from .base import LLMProvider, LLMResponse

logger = structlog.get_logger(__name__)

_DEFAULT_BASE_URL = "https://api.deepseek.com"
_DEFAULT_MODEL = "deepseek-chat"


class CloudLLMProvider(LLMProvider):
    """LLM provider that calls any OpenAI-compatible ``/v1/chat/completions`` endpoint."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self._api_key = api_key or os.getenv("DIRECTOR_CLOUD_API_KEY", "")
        self._base_url = (base_url or os.getenv("DIRECTOR_CLOUD_BASE_URL", _DEFAULT_BASE_URL)).rstrip("/")
        self._model = model or os.getenv("DIRECTOR_CLOUD_MODEL", _DEFAULT_MODEL)
        self._timeout = timeout

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Call the OpenAI-compatible chat completions endpoint."""
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]["message"]
        usage = data.get("usage")

        await logger.adebug(
            "cloud_llm_response",
            model=self._model,
            usage=usage,
        )

        return LLMResponse(
            content=choice["content"],
            model=data.get("model", self._model),
            usage=usage,
        )

    async def is_available(self) -> bool:
        """Return True when an API key is configured."""
        return bool(self._api_key)
