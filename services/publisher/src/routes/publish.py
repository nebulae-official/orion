"""Content publishing endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.config import get_settings
from orion_common.db.session import get_session
from orion_common.event_bus import EventBus

from src.repositories.publish_repo import PublishRepository
from src.schemas import (
    PublishRecordResponse,
    PublishRequest,
    PublishResponse,
)
from src.services.publisher import PublishingService

router = APIRouter(prefix="/api/v1/publish", tags=["publish"])


@router.post("/", response_model=PublishResponse)
async def publish_content(
    body: PublishRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PublishResponse:
    """Publish approved content to social platforms."""
    settings = get_settings()
    event_bus = EventBus(settings.redis_url)

    try:
        svc = PublishingService(session=session, event_bus=event_bus)
        return await svc.publish_content(body.content_id, body.platforms)
    except ValueError as exc:
        status = 409 if "approved" in str(exc) else 422
        raise HTTPException(status_code=status, detail=str(exc))
    finally:
        await event_bus.close()


@router.get("/history", response_model=list[PublishRecordResponse])
async def list_publish_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    content_id: UUID | None = None,
    limit: int = 50,
) -> list:
    """List publish history records."""
    repo = PublishRepository(session)
    return await repo.list_records(content_id=content_id, limit=limit)
