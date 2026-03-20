"""Background event listener that creates notifications from domain events."""

from __future__ import annotations

import json
import uuid

import redis.asyncio as aioredis
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orion_common.db.models import User, UserSettings
from orion_common.events import Channels

from ..repositories.notification_repo import NotificationRepository
from .notification_service import NotificationService

logger = structlog.get_logger()

# Maps Redis channel -> (notification_type, title_template, target_mode)
# target_mode: "creator" = notify content.created_by, "broadcast" = notify all admin/editor users
EVENT_MAP: dict[str, tuple[str, str, str]] = {
    Channels.TREND_DETECTED: (
        "trend.detected",
        "New trend detected: {topic}",
        "broadcast",
    ),
    Channels.CONTENT_PUBLISHED: (
        "content.published",
        "Content published: {title}",
        "creator",
    ),
    Channels.CONTENT_REJECTED: (
        "content.rejected",
        "Content rejected: {title}",
        "creator",
    ),
    Channels.MEDIA_FAILED: (
        "media.failed",
        "Media generation failed for: {title}",
        "creator",
    ),
    Channels.PIPELINE_STAGE_CHANGED: (
        "pipeline.stage_changed",
        "Pipeline stage: {stage} for {title}",
        "creator",
    ),
    Channels.CONTENT_CREATED: (
        "content.created",
        "New content created: {title}",
        "creator",
    ),
}


async def notification_consumer(
    redis: aioredis.Redis,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Subscribe to domain events and create notifications.

    Runs as an infinite loop inside an asyncio task.
    """
    pubsub = redis.pubsub()
    await pubsub.subscribe(*EVENT_MAP.keys())
    logger.info("notification_consumer_started", channels=list(EVENT_MAP.keys()))

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue

        channel = message["channel"]
        if isinstance(channel, bytes):
            channel = channel.decode()

        try:
            data = json.loads(message["data"])
        except (json.JSONDecodeError, TypeError):
            logger.warning("notification_consumer_bad_payload", channel=channel)
            continue

        mapping = EVENT_MAP.get(channel)
        if not mapping:
            continue

        notif_type, title_template, target_mode = mapping

        try:
            title = title_template.format(**data)
        except KeyError:
            title = title_template  # fallback if template fields missing

        async with session_factory() as session:
            repo = NotificationRepository(session)
            service = NotificationService(repo, redis)

            try:
                if target_mode == "creator":
                    await _handle_creator_notification(
                        session, service, data, notif_type, title
                    )
                elif target_mode == "broadcast":
                    await _handle_broadcast_notification(
                        session, service, data, notif_type, title
                    )
                await session.commit()
            except Exception:
                logger.exception("notification_consumer_error", channel=channel)
                await session.rollback()
                continue

        logger.debug("notification_created", channel=channel, type=notif_type)


async def _handle_creator_notification(
    session: AsyncSession,
    service: NotificationService,
    data: dict,
    notif_type: str,
    title: str,
) -> None:
    """Create a notification for the content creator."""
    created_by = data.get("created_by")
    if not created_by:
        logger.warning("notification_consumer_no_creator", type=notif_type)
        return
    user_id = uuid.UUID(created_by)
    prefs = await _get_user_prefs(session, user_id)
    type_prefs = prefs.get(notif_type.replace(".", "_"), {})
    if type_prefs.get("enabled", True) is False:
        return
    push = type_prefs.get("push", True)
    await service.create_notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        metadata=data,
        push=push,
    )


async def _handle_broadcast_notification(
    session: AsyncSession,
    service: NotificationService,
    data: dict,
    notif_type: str,
    title: str,
) -> None:
    """Create a notification for all admin and editor users."""
    result = await session.execute(
        select(User.id).where(
            User.role.in_(["admin", "editor"]),
            User.is_active == True,  # noqa: E712
        )
    )
    user_ids = [row[0] for row in result.all()]
    for uid in user_ids:
        prefs = await _get_user_prefs(session, uid)
        type_prefs = prefs.get(notif_type.replace(".", "_"), {})
        if type_prefs.get("enabled", True) is False:
            continue
        push = type_prefs.get("push", True)
        await service.create_notification(
            user_id=uid,
            type=notif_type,
            title=title,
            metadata=data,
            push=push,
        )


async def _get_user_prefs(session: AsyncSession, user_id: uuid.UUID) -> dict:
    """Load notification preferences from user settings."""
    result = await session.execute(
        select(UserSettings.settings).where(UserSettings.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row and isinstance(row, dict):
        return row.get("notification_preferences", {})
    return {}
