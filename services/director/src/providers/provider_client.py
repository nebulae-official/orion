from __future__ import annotations

import os

import httpx
import structlog
from orion_common.provider_context import request_user_id

from .base import LLMProvider, LLMResponse

logger = structlog.get_logger(__name__)


class ProviderServiceClient(LLMProvider):
    """LLM provider that delegates to the Orion Provider Service."""

    def __init__(self) -> None:
        self._provider_url = os.getenv("PROVIDER_URL", "http://provider:8008").rstrip("/")

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        payload = {
            "prompt": prompt,
            "system_prompt": system_prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers: dict[str, str] = {}
        user_id = request_user_id.get()
        if user_id:
            headers["X-User-ID"] = user_id
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            resp = await client.post(
                f"{self._provider_url}/api/v1/llm/complete",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        return LLMResponse(
            content=data["content"],
            model=data["model"],
            usage=data.get("usage"),
            provider=data.get("provider", ""),
        )

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                resp = await client.get(f"{self._provider_url}/health")
                return resp.status_code == 200
        except Exception:  # Provider Service unreachable
            return False
