"""Routes for per-user provider preference management."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from orion_common.db.session import get_session
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import user_repo

router = APIRouter(prefix="/api/v1/settings", tags=["providers"])


def _get_user_id(request: Request) -> uuid.UUID:
    raw = request.headers.get("X-User-ID")
    if not raw:
        raise HTTPException(status_code=401, detail="Missing user context")
    return uuid.UUID(raw)


class ProviderPreferences(BaseModel):
    """Per-user provider preferences stored in user_settings JSON."""

    llm_provider: str | None = Field(
        None, description="Preferred LLM provider (e.g. 'LOCAL', 'CLOUD')"
    )
    llm_model: str | None = Field(None, description="Preferred LLM model")
    image_provider: str | None = Field(
        None, description="Preferred image provider (e.g. 'comfyui', 'fal_ai')"
    )
    image_model: str | None = Field(None, description="Preferred image model")
    tts_provider: str | None = Field(
        None, description="Preferred TTS provider (e.g. 'LOCAL', 'CLOUD')"
    )
    tts_voice_id: str | None = Field(None, description="Preferred TTS voice ID")


class ProviderPreferencesResponse(BaseModel):
    providers: ProviderPreferences


@router.get("/providers", response_model=ProviderPreferencesResponse)
async def get_provider_preferences(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProviderPreferencesResponse:
    """Return the current user's provider preferences."""
    user_id = _get_user_id(request)
    settings = await user_repo.get_user_settings(session, user_id)
    if settings is None:
        return ProviderPreferencesResponse(providers=ProviderPreferences())

    prefs_data = settings.settings.get("providers", {})
    return ProviderPreferencesResponse(providers=ProviderPreferences(**prefs_data))


@router.put("/providers", response_model=ProviderPreferencesResponse)
async def update_provider_preferences(
    body: ProviderPreferences,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProviderPreferencesResponse:
    """Update the current user's provider preferences (partial merge)."""
    user_id = _get_user_id(request)

    # Only include non-None fields for partial merge
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    settings = await user_repo.upsert_user_settings(session, user_id, {"providers": updates})
    prefs_data = settings.settings.get("providers", {})
    return ProviderPreferencesResponse(providers=ProviderPreferences(**prefs_data))
