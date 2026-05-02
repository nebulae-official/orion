"""Routes for per-user encrypted API key management."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from orion_common.db.session import get_session
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.key_repo import KeyRepository

router = APIRouter(prefix="/api/v1/keys", tags=["keys"])

ALLOWED_PROVIDERS = frozenset(
    {
        "openai",
        "anthropic",
        "fal_ai",
        "elevenlabs",
        "deepseek",
        "groq",
        "replicate",
        "runway",
        "nvidia_nim",
        "huggingface",
        "pollinations",
    }
)


def _get_user_id(request: Request) -> uuid.UUID:
    raw = request.headers.get("X-User-ID")
    if not raw:
        raise HTTPException(status_code=401, detail="Missing user context")
    return uuid.UUID(raw)


class StoreKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=1, description="The raw API key to encrypt and store")


class KeyMetadata(BaseModel):
    provider: str
    created_at: str
    updated_at: str


class KeyListResponse(BaseModel):
    keys: list[KeyMetadata]


class KeyValueResponse(BaseModel):
    provider: str
    api_key: str


class MessageResponse(BaseModel):
    message: str


@router.post(
    "/{provider}",
    response_model=MessageResponse,
    status_code=201,
)
async def store_key(
    provider: str,
    body: StoreKeyRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageResponse:
    """Store or update an encrypted API key for a provider."""
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    user_id = _get_user_id(request)
    repo = KeyRepository(session)
    await repo.upsert(user_id, provider, body.api_key)
    return MessageResponse(message=f"API key for {provider} stored successfully")


@router.get("", response_model=KeyListResponse)
async def list_keys(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> KeyListResponse:
    """List all stored provider keys (metadata only, no secrets)."""
    user_id = _get_user_id(request)
    repo = KeyRepository(session)
    keys = await repo.list_providers(user_id)
    return KeyListResponse(keys=[KeyMetadata(**k) for k in keys])


@router.get("/{provider}", response_model=KeyValueResponse)
async def get_key(
    provider: str,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> KeyValueResponse:
    """Return the decrypted API key for a provider.

    This endpoint is intended for internal service-to-service calls (e.g.
    Director fetching the user's OpenAI key before running a pipeline).
    The ``X-Internal-Token`` header is validated by the ``InternalAuthMiddleware``
    already applied to the whole app.
    """
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    user_id = _get_user_id(request)
    repo = KeyRepository(session)
    api_key = await repo.get_decrypted(user_id, provider)
    if api_key is None:
        raise HTTPException(status_code=404, detail=f"No key stored for provider: {provider}")
    return KeyValueResponse(provider=provider, api_key=api_key)


@router.delete("/{provider}", response_model=MessageResponse)
async def delete_key(
    provider: str,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageResponse:
    """Delete a stored API key for a provider."""
    user_id = _get_user_id(request)
    repo = KeyRepository(session)
    deleted = await repo.delete(user_id, provider)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No key found for provider: {provider}")
    return MessageResponse(message=f"API key for {provider} deleted")
