from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Request

from src.adapters.base import BaseLLMAdapter
from src.adapters.llm.huggingface import HuggingFaceLLMAdapter
from src.adapters.llm.nvidia_nim import NvidiaNimLLMAdapter
from src.adapters.llm.pollinations import PollinationsLLMAdapter
from src.catalog import Capability, get_entry
from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import LLMCompleteRequest, LLMCompleteResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

_DEFAULT_PROVIDER = "nvidia_nim"
_FALLBACK_PROVIDER = "pollinations"

_LLM_ADAPTERS: dict[str, type[BaseLLMAdapter]] = {
    "nvidia_nim": NvidiaNimLLMAdapter,
    "huggingface": HuggingFaceLLMAdapter,
    "pollinations": PollinationsLLMAdapter,
}


@router.post("/complete", response_model=LLMCompleteResponse)
async def complete(body: LLMCompleteRequest, request: Request) -> LLMCompleteResponse:
    provider_name = body.provider or _DEFAULT_PROVIDER
    try:
        entry = get_entry(Capability.LLM, provider_name)
    except KeyError:
        raise HTTPException(status_code=422, detail=f"Unknown provider: '{provider_name}'")

    messages: list[dict] = []
    if body.system_prompt is not None:
        messages.append({"role": "system", "content": body.system_prompt})
    messages.append({"role": "user", "content": body.prompt})

    key_resolver: KeyResolver = request.app.state.key_resolver
    user_id = request.headers.get("X-User-ID")
    try:
        api_key = await key_resolver.resolve(user_id, provider_name)
    except KeyUnavailableError:
        # Primary provider has no key — fall back to HuggingFace anonymous inference.
        if provider_name != _FALLBACK_PROVIDER and _FALLBACK_PROVIDER in _LLM_ADAPTERS:
            logger.warning(
                "llm_key_unavailable_falling_back",
                primary=provider_name,
                fallback=_FALLBACK_PROVIDER,
            )
            provider_name = _FALLBACK_PROVIDER
            try:
                entry = get_entry(Capability.LLM, _FALLBACK_PROVIDER)
            except KeyError:
                raise HTTPException(status_code=503, detail="No LLM provider available")
            api_key = await key_resolver.resolve(user_id, _FALLBACK_PROVIDER)
        else:
            raise HTTPException(status_code=503, detail="No API key configured for this provider")

    adapter_cls = _LLM_ADAPTERS.get(provider_name)
    if adapter_cls is None:
        raise HTTPException(
            status_code=422, detail=f"No adapter registered for provider '{provider_name}'"
        )

    try:
        adapter = adapter_cls(entry)
        result = await adapter.complete(
            api_key=api_key,
            messages=messages,
            model=body.model,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
    except HTTPException:
        raise
    except Exception as exc:  # litellm raises heterogeneous exception types
        logger.error("llm_completion_failed", provider=provider_name, error=str(exc))
        raise HTTPException(status_code=502, detail="LLM provider error") from exc

    return LLMCompleteResponse(content=result.content, model=result.model, usage=result.usage, provider=provider_name)
