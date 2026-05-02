"""HuggingFace Inference API LLM adapter.

Calls the OpenAI-compatible chat completions endpoint:
  POST https://api-inference.huggingface.co/models/{model}/v1/chat/completions

Works anonymously (empty api_key) for public non-gated models with rate limiting.
Pass a HF_TOKEN for higher limits.
"""

from __future__ import annotations

import httpx
import structlog
from fastapi import HTTPException

from src.adapters.base import BaseLLMAdapter, LLMResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class HuggingFaceLLMAdapter(BaseLLMAdapter):
    """Calls HuggingFace Inference API chat completions."""

    def __init__(self, entry: ProviderEntry) -> None:
        self._entry = entry

    async def complete(
        self,
        *,
        api_key: str,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResult:
        effective_model = model or self._entry.default_model
        url = f"{self._entry.base_url}/models/{effective_model}/v1/chat/completions"

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
            logger.error("huggingface_llm_api_error", status=status, model=effective_model)
            if status == 401:
                raise HTTPException(
                    status_code=503,
                    detail="HuggingFace model requires authentication — set HF_TOKEN",
                ) from exc
            if status == 429:
                raise HTTPException(
                    status_code=503, detail="HuggingFace rate limit exceeded"
                ) from exc
            raise HTTPException(status_code=502, detail="LLM provider error") from exc
        except Exception as exc:  # network errors, timeouts — httpx raises heterogeneous types
            logger.error("huggingface_llm_request_failed", model=effective_model, error=str(exc))
            raise HTTPException(status_code=502, detail="LLM provider error") from exc

        choice = data["choices"][0]
        content: str = choice["message"]["content"]
        usage = data.get("usage")

        logger.info("llm_completion_ok", provider="huggingface", model=effective_model, usage=usage)

        return LLMResult(content=content, model=effective_model, usage=usage)
