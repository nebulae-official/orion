"""Async SQLAlchemy repository for notifications."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import Notification


class NotificationRepository:
    """Database access layer for notifications."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        """Insert a new notification."""
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            metadata_=metadata,
        )
        self._session.add(notification)
        await self._session.flush()
        return notification

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int]:
        """Return a paginated list of notifications with total count."""
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read == False)  # noqa: E712
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.order_by(Notification.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self._session.execute(query)
        return list(result.scalars().all()), total

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        """Return the number of unread notifications for a user."""
        query = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        )
        return (await self._session.execute(query)).scalar_one()

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Mark a single notification as read. Returns True if found."""
        result = await self._session.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        return result.rowcount > 0

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        """Mark all unread notifications as read. Returns count updated."""
        result = await self._session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        return result.rowcount
