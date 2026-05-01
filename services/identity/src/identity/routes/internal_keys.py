"""Internal routes for service-to-service system key fetching."""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException
from orion_common.db.session import get_session
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.system_key_repository import SystemKeyRepository

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


class SystemKeyResponse(BaseModel):
    key: str


@router.get("/system-keys/{provider}", response_model=SystemKeyResponse)
async def get_system_key(
    provider: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SystemKeyResponse:
    """Return the decrypted system key for *provider*.

    Called by Provider Service, not the dashboard. The InternalAuthMiddleware
    on the app validates X-Internal-Token before this handler runs.
    """
    repo = SystemKeyRepository(session)
    key = await repo.get(provider)
    if key is None:
        raise HTTPException(status_code=404, detail=f"No system key configured for: {provider}")
    return SystemKeyResponse(key=key)
