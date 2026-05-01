"""Admin routes for system-level (org-wide) provider API key management."""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from orion_common.db.session import get_session
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.system_key_repository import SystemKeyRepository
from .keys import ALLOWED_PROVIDERS

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/admin/keys", tags=["admin-keys"])


def _require_admin(request: Request) -> None:
    """Raise 403 if caller is not an admin (role injected by gateway)."""
    role = request.headers.get("X-User-Role", "viewer")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


class UpsertSystemKeyRequest(BaseModel):
    key: str = Field(..., min_length=1, description="The raw API key to encrypt and store")


class SystemKeyStatus(BaseModel):
    provider: str
    is_configured: bool


class SystemKeyListResponse(BaseModel):
    keys: list[SystemKeyStatus]


class MessageResponse(BaseModel):
    message: str


@router.get("", response_model=SystemKeyListResponse)
async def list_system_keys(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SystemKeyListResponse:
    """Return configuration status for all allowed providers (admin only).

    Never returns raw key values — only whether each provider has a key stored.
    """
    _require_admin(request)
    repo = SystemKeyRepository(session)
    items = await repo.list_providers(ALLOWED_PROVIDERS)
    return SystemKeyListResponse(keys=[SystemKeyStatus(**i) for i in items])


@router.put("/{provider}", response_model=MessageResponse)
async def upsert_system_key(
    provider: str,
    body: UpsertSystemKeyRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageResponse:
    """Store or replace the system-level API key for a provider (admin only)."""
    _require_admin(request)
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    repo = SystemKeyRepository(session)
    await repo.upsert(provider, body.key)
    await logger.ainfo("system_key_upserted", provider=provider)
    return MessageResponse(message=f"System API key for {provider} stored successfully")
