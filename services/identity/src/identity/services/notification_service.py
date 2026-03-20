"""Notification business logic and real-time push."""

from __future__ import annotations

import json
import uuid

import redis.asyncio as aioredis
import structlog

from ..repositories.notification_repo import NotificationRepository
from ..schemas.notifications import NotificationOut

logger = structlog.get_logger()

NOTIFICATION_CREATED_CHANNEL = "orion.notification.created"


class NotificationService:
    """Creates notifications and publishes them for real-time delivery."""

    def __init__(self, repo: NotificationRepository, redis: aioredis.Redis) -> None:
        self._repo = repo
        self._redis = redis

    async def create_notification(
        self,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        metadata: dict | None = None,
        push: bool = True,
    ) -> NotificationOut:
        """Create a notification and optionally push via WebSocket."""
        notification = await self._repo.create(
            user_id=user_id, type=type, title=title, body=body, metadata=metadata
        )
        out = NotificationOut.model_validate(notification)

        if push:
            await self._publish_ws(user_id, out)

        return out

    async def _publish_ws(self, user_id: uuid.UUID, notification: NotificationOut) -> None:
        """Publish to Redis so the Gateway WebSocket Hub can push to the user."""
        payload = {
            "user_id": str(user_id),
            "notification": notification.model_dump(mode="json"),
        }
        await self._redis.publish(NOTIFICATION_CREATED_CHANNEL, json.dumps(payload))

    async def list_notifications(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[NotificationOut], int]:
        """List notifications for a user with pagination."""
        notifications, total = await self._repo.list_for_user(
            user_id, unread_only=unread_only, page=page, page_size=page_size
        )
        return [NotificationOut.model_validate(n) for n in notifications], total

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        """Return unread notification count."""
        return await self._repo.get_unread_count(user_id)

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Mark a single notification as read."""
        return await self._repo.mark_read(notification_id, user_id)

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        """Mark all unread notifications as read."""
        return await self._repo.mark_all_read(user_id)
