from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Request

from src.adapters.llm.nvidia_nim import NvidiaNimLLMAdapter
from src.catalog import Capability, get_entry
from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import LLMCompleteRequest, LLMCompleteResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

_DEFAULT_PROVIDER = "nvidia_nim"


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
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"), provider_name)
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    try:
        adapter = NvidiaNimLLMAdapter(entry)
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

    return LLMCompleteResponse(content=result.content, model=result.model, usage=result.usage)
