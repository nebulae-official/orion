"""Pydantic schemas for the notification API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    """Response schema for a notification."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    metadata: dict[str, Any] | None = Field(None, alias="metadata_")
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationListOut(BaseModel):
    """Paginated notification list."""

    items: list[NotificationOut]
    total: int
    page: int
    page_size: int


class UnreadCountOut(BaseModel):
    """Unread notification count."""

    count: int


class NotificationPreference(BaseModel):
    """Preference for a single notification type."""

    enabled: bool = True
    push: bool = True


class NotificationPreferencesOut(BaseModel):
    """All notification preferences."""

    trend_detected: NotificationPreference = NotificationPreference()
    content_published: NotificationPreference = NotificationPreference()
    content_rejected: NotificationPreference = NotificationPreference()
    media_failed: NotificationPreference = NotificationPreference()
    pipeline_stage_changed: NotificationPreference = NotificationPreference(
        enabled=False, push=False
    )
    content_created: NotificationPreference = NotificationPreference(enabled=False, push=False)


class NotificationPreferencesIn(BaseModel):
    """Update notification preferences."""

    trend_detected: NotificationPreference | None = None
    content_published: NotificationPreference | None = None
    content_rejected: NotificationPreference | None = None
    media_failed: NotificationPreference | None = None
    pipeline_stage_changed: NotificationPreference | None = None
    content_created: NotificationPreference | None = None
