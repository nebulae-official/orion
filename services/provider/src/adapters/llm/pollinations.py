"""Pollinations text generation adapter — free, anonymous, no API key required.

Calls the OpenAI-compatible chat completions endpoint:
  POST https://text.pollinations.ai/openai/v1/chat/completions

Works without authentication.  Rate-limited for anonymous requests.
"""

from __future__ import annotations

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseLLMAdapter, LLMResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class PollinationsLLMAdapter(BaseLLMAdapter):
    """Calls the Pollinations text generation API."""

    def __init__(self, entry: ProviderEntry) -> None:
        self._entry = entry

    async def complete(
        self,
        *,
        api_key: str,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> LLMResult:
        effective_model = model or self._entry.default_model
        url = f"{self._entry.base_url}/openai/v1/chat/completions"

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": effective_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.error("pollinations_llm_api_error", status=status, model=effective_model)
            raise HTTPException(status_code=502, detail="LLM provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("pollinations_llm_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="LLM provider error") from exc

        choice = data["choices"][0]
        content: str = choice["message"]["content"]
        usage = data.get("usage")
        response_model: str = data.get("model", effective_model)

        logger.info("llm_completion_ok", provider="pollinations", model=response_model, usage=usage)

        return LLMResult(content=content, model=response_model, usage=usage)
