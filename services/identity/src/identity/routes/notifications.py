"""Notification REST API endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.auth import CurrentUser, get_current_user
from orion_common.db.session import get_session

from ..repositories.notification_repo import NotificationRepository
from ..repositories import user_repo
from ..schemas.notifications import (
    NotificationListOut,
    NotificationPreferencesIn,
    NotificationPreferencesOut,
    UnreadCountOut,
)
from ..services.notification_service import NotificationService

logger = structlog.get_logger()

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_service(session: AsyncSession = Depends(get_session)) -> NotificationService:
    """Build a NotificationService from the request-scoped session."""
    from ..main import redis_client

    repo = NotificationRepository(session)
    return NotificationService(repo, redis_client)


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
    unread: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> NotificationListOut:
    """List notifications for the authenticated user."""
    user_id = uuid.UUID(user.user_id)
    items, total = await service.list_notifications(
        user_id, unread_only=unread, page=page, page_size=page_size
    )
    return NotificationListOut(items=items, total=total, page=page, page_size=page_size)


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> dict:
    """Mark a single notification as read."""
    user_id = uuid.UUID(user.user_id)
    success = await service.mark_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> dict:
    """Mark all notifications as read for the authenticated user."""
    user_id = uuid.UUID(user.user_id)
    count = await service.mark_all_read(user_id)
    return {"status": "ok", "marked": count}


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    service: Annotated[NotificationService, Depends(_get_service)],
) -> UnreadCountOut:
    """Get unread notification count."""
    user_id = uuid.UUID(user.user_id)
    count = await service.get_unread_count(user_id)
    return UnreadCountOut(count=count)


@router.get("/preferences", response_model=NotificationPreferencesOut)
async def get_preferences(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    session: AsyncSession = Depends(get_session),
) -> NotificationPreferencesOut:
    """Get notification preferences from user settings."""
    user_id = uuid.UUID(user.user_id)
    settings_row = await user_repo.get_user_settings(session, user_id)
    prefs = {}
    if settings_row:
        prefs = settings_row.settings.get("notification_preferences", {})
    return NotificationPreferencesOut(**prefs)


@router.put("/preferences", response_model=NotificationPreferencesOut)
async def update_preferences(
    body: NotificationPreferencesIn,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    session: AsyncSession = Depends(get_session),
) -> NotificationPreferencesOut:
    """Update notification preferences in user settings."""
    user_id = uuid.UUID(user.user_id)
    settings_row = await user_repo.get_user_settings(session, user_id)
    current_settings = settings_row.settings if settings_row else {}
    prefs = current_settings.get("notification_preferences", {})

    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        prefs[key] = value if isinstance(value, dict) else value
    current_settings["notification_preferences"] = prefs

    await user_repo.upsert_user_settings(session, user_id, current_settings)
    return NotificationPreferencesOut(**prefs)
