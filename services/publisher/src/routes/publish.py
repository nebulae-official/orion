"""Content publishing endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from orion_common.auth import CurrentUser, get_current_user
from orion_common.db.session import get_session
from orion_common.event_bus import EventBus
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_event_bus
from src.exceptions import ContentNotApprovedError, ContentNotFoundError, SafetyCheckFailedError
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
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
    user: CurrentUser = Depends(get_current_user),
) -> PublishResponse:
    """Publish approved content to social platforms."""
    try:
        svc = PublishingService(session=session, event_bus=event_bus)
        return await svc.publish_content(
            body.content_id,
            body.platforms,
            user_id=user.user_id if not user.is_admin else None,
        )
    except ContentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ContentNotApprovedError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except SafetyCheckFailedError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/history", response_model=list[PublishRecordResponse])
async def list_publish_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
    content_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list:
    """List publish history records."""
    repo = PublishRepository(session)
    scope_user_id = None if user.is_admin else UUID(user.user_id)
    return await repo.list_records(content_id=content_id, limit=limit, user_id=scope_user_id)
