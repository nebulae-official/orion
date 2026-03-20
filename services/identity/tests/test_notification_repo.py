"""Unit tests for the notification repository."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.identity.repositories.notification_repo import NotificationRepository


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.flush = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def repo(mock_session: AsyncMock) -> NotificationRepository:
    return NotificationRepository(mock_session)


@pytest.fixture
def user_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
async def test_create_notification(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """create() adds a Notification to the session and flushes."""
    notification = await repo.create(
        user_id=user_id,
        type="trend.detected",
        title="New trend detected: AI Coding",
        body="Trending on Google Trends",
        metadata={"trend_id": str(uuid.uuid4()), "source": "google_trends"},
    )

    mock_session.add.assert_called_once()
    mock_session.flush.assert_awaited_once()
    assert notification.user_id == user_id
    assert notification.type == "trend.detected"
    assert notification.title == "New trend detected: AI Coding"
    assert notification.body == "Trending on Google Trends"
    assert notification.metadata_ is not None


@pytest.mark.asyncio
async def test_create_notification_minimal(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """create() works with only required fields."""
    notification = await repo.create(
        user_id=user_id,
        type="content.published",
        title="Content published: My Video",
    )

    mock_session.add.assert_called_once()
    assert notification.body is None
    assert notification.metadata_ is None


@pytest.mark.asyncio
async def test_list_for_user_all(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """list_for_user() returns paginated results with total count."""
    mock_notif = MagicMock()
    mock_notif.user_id = user_id
    mock_notif.type = "trend.detected"

    # Mock count query
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1

    # Mock list query
    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = [mock_notif]

    mock_session.execute = AsyncMock(side_effect=[count_result, list_result])

    items, total = await repo.list_for_user(user_id, page=1, page_size=20)

    assert total == 1
    assert len(items) == 1
    assert items[0].user_id == user_id


@pytest.mark.asyncio
async def test_list_for_user_unread_only(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """list_for_user(unread_only=True) filters to unread notifications."""
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0

    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = []

    mock_session.execute = AsyncMock(side_effect=[count_result, list_result])

    items, total = await repo.list_for_user(user_id, unread_only=True)

    assert total == 0
    assert len(items) == 0
    # Executed twice: once for count, once for the list
    assert mock_session.execute.await_count == 2


@pytest.mark.asyncio
async def test_list_for_user_pagination(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """list_for_user() respects page and page_size parameters."""
    count_result = MagicMock()
    count_result.scalar_one.return_value = 50

    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = [MagicMock() for _ in range(10)]

    mock_session.execute = AsyncMock(side_effect=[count_result, list_result])

    items, total = await repo.list_for_user(user_id, page=3, page_size=10)

    assert total == 50
    assert len(items) == 10


@pytest.mark.asyncio
async def test_get_unread_count(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """get_unread_count() returns the number of unread notifications."""
    result = MagicMock()
    result.scalar_one.return_value = 5
    mock_session.execute = AsyncMock(return_value=result)

    count = await repo.get_unread_count(user_id)

    assert count == 5


@pytest.mark.asyncio
async def test_get_unread_count_zero(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """get_unread_count() returns zero when no unread notifications exist."""
    result = MagicMock()
    result.scalar_one.return_value = 0
    mock_session.execute = AsyncMock(return_value=result)

    count = await repo.get_unread_count(user_id)

    assert count == 0


@pytest.mark.asyncio
async def test_mark_read_existing(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """mark_read() returns True when the notification exists and belongs to the user."""
    result = MagicMock()
    result.rowcount = 1
    mock_session.execute = AsyncMock(return_value=result)

    notification_id = uuid.uuid4()
    success = await repo.mark_read(notification_id, user_id)

    assert success is True


@pytest.mark.asyncio
async def test_mark_read_not_found(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """mark_read() returns False when the notification is not found."""
    result = MagicMock()
    result.rowcount = 0
    mock_session.execute = AsyncMock(return_value=result)

    notification_id = uuid.uuid4()
    success = await repo.mark_read(notification_id, user_id)

    assert success is False


@pytest.mark.asyncio
async def test_mark_read_wrong_user(repo: NotificationRepository, mock_session: AsyncMock) -> None:
    """mark_read() returns False when notification belongs to a different user."""
    result = MagicMock()
    result.rowcount = 0
    mock_session.execute = AsyncMock(return_value=result)

    notification_id = uuid.uuid4()
    wrong_user_id = uuid.uuid4()
    success = await repo.mark_read(notification_id, wrong_user_id)

    assert success is False


@pytest.mark.asyncio
async def test_mark_all_read(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """mark_all_read() returns the count of updated notifications."""
    result = MagicMock()
    result.rowcount = 3
    mock_session.execute = AsyncMock(return_value=result)

    count = await repo.mark_all_read(user_id)

    assert count == 3


@pytest.mark.asyncio
async def test_mark_all_read_none_unread(repo: NotificationRepository, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    """mark_all_read() returns 0 when there are no unread notifications."""
    result = MagicMock()
    result.rowcount = 0
    mock_session.execute = AsyncMock(return_value=result)

    count = await repo.mark_all_read(user_id)

    assert count == 0
