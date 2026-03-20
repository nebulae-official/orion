"""Unit tests for the notification service layer."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.identity.repositories.notification_repo import NotificationRepository
from src.identity.schemas.notifications import NotificationOut
from src.identity.services.notification_service import (
    NOTIFICATION_CREATED_CHANNEL,
    NotificationService,
)


@pytest.fixture
def mock_repo() -> AsyncMock:
    return AsyncMock(spec=NotificationRepository)


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.publish = AsyncMock(return_value=1)
    return redis


@pytest.fixture
def service(mock_repo: AsyncMock, mock_redis: AsyncMock) -> NotificationService:
    return NotificationService(mock_repo, mock_redis)


@pytest.fixture
def user_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def sample_notification(user_id: uuid.UUID) -> MagicMock:
    notif = MagicMock()
    notif.id = uuid.uuid4()
    notif.user_id = user_id
    notif.type = "trend.detected"
    notif.title = "New trend detected: AI Coding"
    notif.body = None
    notif.metadata_ = {"trend_id": str(uuid.uuid4())}
    notif.is_read = False
    notif.read_at = None
    notif.created_at = datetime(2026, 3, 20, 12, 0, 0, tzinfo=UTC)
    return notif


@pytest.mark.asyncio
async def test_create_notification_with_push(
    service: NotificationService,
    mock_repo: AsyncMock,
    mock_redis: AsyncMock,
    user_id: uuid.UUID,
    sample_notification: MagicMock,
) -> None:
    """create_notification() persists via repo and publishes to Redis when push=True."""
    mock_repo.create.return_value = sample_notification

    result = await service.create_notification(
        user_id=user_id,
        type="trend.detected",
        title="New trend detected: AI Coding",
        push=True,
    )

    mock_repo.create.assert_awaited_once()
    mock_redis.publish.assert_awaited_once()
    # Verify the Redis channel
    call_args = mock_redis.publish.call_args
    assert call_args[0][0] == NOTIFICATION_CREATED_CHANNEL
    # Verify the payload is valid JSON with user_id
    payload = json.loads(call_args[0][1])
    assert payload["user_id"] == str(user_id)
    assert "notification" in payload
    assert isinstance(result, NotificationOut)


@pytest.mark.asyncio
async def test_create_notification_without_push(
    service: NotificationService,
    mock_repo: AsyncMock,
    mock_redis: AsyncMock,
    user_id: uuid.UUID,
    sample_notification: MagicMock,
) -> None:
    """create_notification() does NOT publish to Redis when push=False."""
    mock_repo.create.return_value = sample_notification

    result = await service.create_notification(
        user_id=user_id,
        type="pipeline.stage_changed",
        title="Pipeline stage: editing for My Video",
        push=False,
    )

    mock_repo.create.assert_awaited_once()
    mock_redis.publish.assert_not_awaited()
    assert isinstance(result, NotificationOut)


@pytest.mark.asyncio
async def test_list_notifications(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
    sample_notification: MagicMock,
) -> None:
    """list_notifications() returns validated NotificationOut objects."""
    mock_repo.list_for_user.return_value = ([sample_notification], 1)

    items, total = await service.list_notifications(user_id, page=1, page_size=20)

    mock_repo.list_for_user.assert_awaited_once_with(
        user_id, unread_only=False, page=1, page_size=20
    )
    assert total == 1
    assert len(items) == 1
    assert isinstance(items[0], NotificationOut)


@pytest.mark.asyncio
async def test_list_notifications_unread_only(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
) -> None:
    """list_notifications(unread_only=True) forwards the filter to the repo."""
    mock_repo.list_for_user.return_value = ([], 0)

    items, total = await service.list_notifications(user_id, unread_only=True)

    mock_repo.list_for_user.assert_awaited_once_with(
        user_id, unread_only=True, page=1, page_size=20
    )
    assert total == 0


@pytest.mark.asyncio
async def test_get_unread_count(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
) -> None:
    """get_unread_count() delegates to the repo."""
    mock_repo.get_unread_count.return_value = 7

    count = await service.get_unread_count(user_id)

    assert count == 7
    mock_repo.get_unread_count.assert_awaited_once_with(user_id)


@pytest.mark.asyncio
async def test_mark_read(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
) -> None:
    """mark_read() delegates to the repo and returns its result."""
    notification_id = uuid.uuid4()
    mock_repo.mark_read.return_value = True

    result = await service.mark_read(notification_id, user_id)

    assert result is True
    mock_repo.mark_read.assert_awaited_once_with(notification_id, user_id)


@pytest.mark.asyncio
async def test_mark_read_not_found(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
) -> None:
    """mark_read() returns False when notification is not found."""
    notification_id = uuid.uuid4()
    mock_repo.mark_read.return_value = False

    result = await service.mark_read(notification_id, user_id)

    assert result is False


@pytest.mark.asyncio
async def test_mark_all_read(
    service: NotificationService,
    mock_repo: AsyncMock,
    user_id: uuid.UUID,
) -> None:
    """mark_all_read() delegates to the repo and returns count."""
    mock_repo.mark_all_read.return_value = 5

    count = await service.mark_all_read(user_id)

    assert count == 5
    mock_repo.mark_all_read.assert_awaited_once_with(user_id)


@pytest.mark.asyncio
async def test_publish_ws_payload_format(
    service: NotificationService,
    mock_repo: AsyncMock,
    mock_redis: AsyncMock,
    user_id: uuid.UUID,
    sample_notification: MagicMock,
) -> None:
    """The Redis payload contains user_id and a serialized notification."""
    mock_repo.create.return_value = sample_notification

    await service.create_notification(
        user_id=user_id,
        type="content.published",
        title="Content published: My Video",
        metadata={"content_id": str(uuid.uuid4())},
        push=True,
    )

    payload_str = mock_redis.publish.call_args[0][1]
    payload = json.loads(payload_str)

    assert payload["user_id"] == str(user_id)
    notif = payload["notification"]
    assert "id" in notif
    assert "type" in notif
    assert "title" in notif
    assert "is_read" in notif
    assert "created_at" in notif
