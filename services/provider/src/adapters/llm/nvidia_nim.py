"""NVIDIA NIM LLM adapter — wraps litellm.acompletion for the NIM inference API."""

from __future__ import annotations

import litellm
import structlog

from src.adapters.base import BaseLLMAdapter, LLMResult
from src.catalog import ProviderEntry

logger = structlog.get_logger(__name__)


class NvidiaNimLLMAdapter(BaseLLMAdapter):
    """Calls NVIDIA NIM chat completions via litellm."""

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

        response = await litellm.acompletion(
            model=f"nvidia_nim/{effective_model}",
            messages=messages,
            api_key=api_key,
            api_base=self._entry.base_url,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content: str = response.choices[0].message.content
        usage = dict(response.usage) if response.usage else None

        logger.info("llm_completion_ok", model=response.model, usage=usage)

        return LLMResult(content=content, model=response.model, usage=usage)
