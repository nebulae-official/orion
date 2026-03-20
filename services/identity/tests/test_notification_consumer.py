"""Unit tests for the notification event consumer."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.identity.services.notification_consumer import (
    EVENT_MAP,
    _get_user_prefs,
    _handle_broadcast_notification,
    _handle_creator_notification,
)


@pytest.fixture
def user_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def mock_session() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_service() -> AsyncMock:
    service = AsyncMock()
    service.create_notification = AsyncMock()
    return service


# ---------------------------------------------------------------------------
# EVENT_MAP coverage
# ---------------------------------------------------------------------------

class TestEventMap:
    def test_all_expected_channels_present(self) -> None:
        """EVENT_MAP contains all six domain event channels."""
        expected_types = {
            "trend.detected",
            "content.published",
            "content.rejected",
            "media.failed",
            "pipeline.stage_changed",
            "content.created",
        }
        actual_types = {v[0] for v in EVENT_MAP.values()}
        assert actual_types == expected_types

    def test_trend_detected_is_broadcast(self) -> None:
        """Trend detected events target broadcast mode."""
        for _channel, (notif_type, _template, target_mode) in EVENT_MAP.items():
            if notif_type == "trend.detected":
                assert target_mode == "broadcast"

    def test_creator_events_target_creator(self) -> None:
        """Content and media events target the creator."""
        creator_types = {
            "content.published",
            "content.rejected",
            "media.failed",
            "pipeline.stage_changed",
            "content.created",
        }
        for _channel, (notif_type, _template, target_mode) in EVENT_MAP.items():
            if notif_type in creator_types:
                assert target_mode == "creator", f"{notif_type} should be creator-targeted"

    def test_title_templates_contain_placeholders(self) -> None:
        """Each title template uses Python format string placeholders."""
        for _channel, (_notif_type, template, _mode) in EVENT_MAP.items():
            assert "{" in template, f"Template missing placeholder: {template}"


# ---------------------------------------------------------------------------
# _handle_creator_notification
# ---------------------------------------------------------------------------

class TestHandleCreatorNotification:
    @pytest.mark.asyncio
    async def test_creates_notification_for_creator(
        self, mock_session: AsyncMock, mock_service: AsyncMock, user_id: uuid.UUID
    ) -> None:
        """Creates a notification for the content creator."""
        data = {"created_by": str(user_id), "title": "My Video"}

        with patch(
            "src.identity.services.notification_consumer._get_user_prefs",
            new_callable=AsyncMock,
            return_value={},
        ):
            await _handle_creator_notification(
                mock_session, mock_service, data, "content.published", "Content published: My Video"
            )

        mock_service.create_notification.assert_awaited_once()
        call_kwargs = mock_service.create_notification.call_args[1]
        assert call_kwargs["user_id"] == user_id
        assert call_kwargs["type"] == "content.published"
        assert call_kwargs["push"] is True

    @pytest.mark.asyncio
    async def test_skips_when_no_created_by(
        self, mock_session: AsyncMock, mock_service: AsyncMock
    ) -> None:
        """Skips notification creation when created_by is missing."""
        data = {"title": "My Video"}

        await _handle_creator_notification(
            mock_session, mock_service, data, "content.published", "Content published: My Video"
        )

        mock_service.create_notification.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_respects_disabled_preference(
        self, mock_session: AsyncMock, mock_service: AsyncMock, user_id: uuid.UUID
    ) -> None:
        """Skips notification when user has disabled this type."""
        data = {"created_by": str(user_id), "title": "My Video"}

        with patch(
            "src.identity.services.notification_consumer._get_user_prefs",
            new_callable=AsyncMock,
            return_value={"content_published": {"enabled": False, "push": True}},
        ):
            await _handle_creator_notification(
                mock_session, mock_service, data, "content.published", "Content published: My Video"
            )

        mock_service.create_notification.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_respects_push_false_preference(
        self, mock_session: AsyncMock, mock_service: AsyncMock, user_id: uuid.UUID
    ) -> None:
        """Creates notification with push=False when user disables push."""
        data = {"created_by": str(user_id), "title": "My Video"}

        with patch(
            "src.identity.services.notification_consumer._get_user_prefs",
            new_callable=AsyncMock,
            return_value={"content_published": {"enabled": True, "push": False}},
        ):
            await _handle_creator_notification(
                mock_session, mock_service, data, "content.published", "Content published: My Video"
            )

        call_kwargs = mock_service.create_notification.call_args[1]
        assert call_kwargs["push"] is False


# ---------------------------------------------------------------------------
# _handle_broadcast_notification
# ---------------------------------------------------------------------------

class TestHandleBroadcastNotification:
    @pytest.mark.asyncio
    async def test_broadcasts_to_admin_and_editor_users(
        self, mock_session: AsyncMock, mock_service: AsyncMock
    ) -> None:
        """Creates notifications for all admin/editor users."""
        user1 = uuid.uuid4()
        user2 = uuid.uuid4()

        mock_result = MagicMock()
        mock_result.all.return_value = [(user1,), (user2,)]
        mock_session.execute = AsyncMock(return_value=mock_result)

        data = {"topic": "AI Coding", "score": 0.95}

        with patch(
            "src.identity.services.notification_consumer._get_user_prefs",
            new_callable=AsyncMock,
            return_value={},
        ):
            await _handle_broadcast_notification(
                mock_session, mock_service, data, "trend.detected", "New trend detected: AI Coding"
            )

        assert mock_service.create_notification.await_count == 2

    @pytest.mark.asyncio
    async def test_skips_user_with_disabled_preference(
        self, mock_session: AsyncMock, mock_service: AsyncMock
    ) -> None:
        """Skips users who have disabled this notification type."""
        user1 = uuid.uuid4()
        user2 = uuid.uuid4()

        mock_result = MagicMock()
        mock_result.all.return_value = [(user1,), (user2,)]
        mock_session.execute = AsyncMock(return_value=mock_result)

        data = {"topic": "AI Coding"}

        # user1 has disabled trend_detected, user2 uses defaults
        prefs_map = {
            user1: {"trend_detected": {"enabled": False}},
            user2: {},
        }

        async def mock_get_prefs(session, uid):
            return prefs_map.get(uid, {})

        with patch(
            "src.identity.services.notification_consumer._get_user_prefs",
            side_effect=mock_get_prefs,
        ):
            await _handle_broadcast_notification(
                mock_session, mock_service, data, "trend.detected", "New trend detected: AI Coding"
            )

        # Only user2 should get a notification
        assert mock_service.create_notification.await_count == 1

    @pytest.mark.asyncio
    async def test_no_users_found(
        self, mock_session: AsyncMock, mock_service: AsyncMock
    ) -> None:
        """No notifications created when no admin/editor users exist."""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        await _handle_broadcast_notification(
            mock_session, mock_service, {}, "trend.detected", "New trend"
        )

        mock_service.create_notification.assert_not_awaited()


# ---------------------------------------------------------------------------
# _get_user_prefs
# ---------------------------------------------------------------------------

class TestGetUserPrefs:
    @pytest.mark.asyncio
    async def test_returns_preferences_from_settings(self, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
        """Returns notification_preferences from the user settings."""
        prefs = {"trend_detected": {"enabled": True, "push": False}}
        result = MagicMock()
        result.scalar_one_or_none.return_value = {"notification_preferences": prefs}
        mock_session.execute = AsyncMock(return_value=result)

        got = await _get_user_prefs(mock_session, user_id)

        assert got == prefs

    @pytest.mark.asyncio
    async def test_returns_empty_dict_when_no_settings(self, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
        """Returns empty dict when user has no settings row."""
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=result)

        got = await _get_user_prefs(mock_session, user_id)

        assert got == {}

    @pytest.mark.asyncio
    async def test_returns_empty_dict_when_no_notification_prefs(self, mock_session: AsyncMock, user_id: uuid.UUID) -> None:
        """Returns empty dict when settings exist but have no notification_preferences."""
        result = MagicMock()
        result.scalar_one_or_none.return_value = {"theme": "dark"}
        mock_session.execute = AsyncMock(return_value=result)

        got = await _get_user_prefs(mock_session, user_id)

        assert got == {}
