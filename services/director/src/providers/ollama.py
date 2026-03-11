"""Ollama LLM provider — calls the local Ollama REST API."""

from __future__ import annotations

import httpx
import structlog

from .base import LLMProvider, LLMResponse

logger = structlog.get_logger(__name__)

_DEFAULT_MODEL = "deepseek-r1:8b"


class OllamaProvider(LLMProvider):
    """LLM provider backed by a local Ollama instance."""

    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = _DEFAULT_MODEL,
        timeout: float = 120.0,
    ) -> None:
        self._host = host.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """Call Ollama ``/api/generate`` and return the final response."""
        payload: dict = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{self._host}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()

        await logger.adebug(
            "ollama_response",
            model=self._model,
            eval_count=data.get("eval_count"),
        )

        return LLMResponse(
            content=data.get("response", ""),
            model=data.get("model", self._model),
            usage={
                "prompt_tokens": data.get("prompt_eval_count"),
                "completion_tokens": data.get("eval_count"),
                "total_duration_ns": data.get("total_duration"),
            },
        )

    async def is_available(self) -> bool:
        """Check that Ollama is reachable via ``/api/tags``."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._host}/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False
