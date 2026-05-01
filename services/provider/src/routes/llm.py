from __future__ import annotations

import os

import litellm
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import LLMCompleteRequest, LLMCompleteResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

_LLM_MODEL = os.getenv("PROVIDER_LLM_MODEL", "meta/llama-3.3-70b-instruct")
_LLM_BASE_URL = os.getenv("PROVIDER_LLM_BASE_URL", "https://integrate.api.nvidia.com/v1")


@router.post("/complete", response_model=LLMCompleteResponse)
async def complete(body: LLMCompleteRequest, request: Request) -> LLMCompleteResponse:
    model = body.model or _LLM_MODEL
    messages: list[dict] = []
    if body.system_prompt is not None:
        messages.append({"role": "system", "content": body.system_prompt})
    messages.append({"role": "user", "content": body.prompt})

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    try:
        response = await litellm.acompletion(
            model=f"nvidia_nim/{model}",
            messages=messages,
            api_key=api_key,
            api_base=_LLM_BASE_URL,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
    except Exception as exc:  # litellm raises heterogeneous exception types
        logger.error("llm_completion_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="LLM provider error") from exc

    content: str = response.choices[0].message.content
    usage = dict(response.usage) if response.usage else None

    logger.info("llm_completion_ok", model=response.model, usage=usage)

    return LLMCompleteResponse(content=content, model=response.model, usage=usage)
