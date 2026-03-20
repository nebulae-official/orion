"""Unit tests for notification Pydantic schemas."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.identity.schemas.notifications import (
    NotificationListOut,
    NotificationOut,
    NotificationPreference,
    NotificationPreferencesIn,
    NotificationPreferencesOut,
    UnreadCountOut,
)


class TestNotificationOut:
    def test_valid_notification(self) -> None:
        notif = NotificationOut(
            id=uuid.uuid4(),
            type="trend.detected",
            title="New trend detected: AI",
            is_read=False,
            created_at=datetime(2026, 3, 20, tzinfo=UTC),
        )
        assert notif.type == "trend.detected"
        assert notif.body is None
        assert notif.metadata is None
        assert notif.read_at is None

    def test_notification_with_all_fields(self) -> None:
        now = datetime.now(UTC)
        notif = NotificationOut(
            id=uuid.uuid4(),
            type="content.published",
            title="Content published: My Video",
            body="Published to YouTube",
            metadata_={"content_id": str(uuid.uuid4())},
            is_read=True,
            read_at=now,
            created_at=now,
        )
        assert notif.body == "Published to YouTube"
        assert notif.metadata is not None
        assert notif.is_read is True
        assert notif.read_at == now

    def test_from_attributes_mode(self) -> None:
        """NotificationOut should work with from_attributes for ORM objects."""
        assert NotificationOut.model_config.get("from_attributes") is True

    def test_metadata_alias(self) -> None:
        """metadata field has alias metadata_ for ORM column mapping."""
        notif = NotificationOut(
            id=uuid.uuid4(),
            type="test",
            title="Test",
            metadata_={"key": "value"},
            is_read=False,
            created_at=datetime.now(UTC),
        )
        assert notif.metadata == {"key": "value"}


class TestNotificationListOut:
    def test_valid_list(self) -> None:
        items = [
            NotificationOut(
                id=uuid.uuid4(),
                type="trend.detected",
                title="Trend",
                is_read=False,
                created_at=datetime.now(UTC),
            )
        ]
        result = NotificationListOut(items=items, total=1, page=1, page_size=20)
        assert result.total == 1
        assert len(result.items) == 1

    def test_empty_list(self) -> None:
        result = NotificationListOut(items=[], total=0, page=1, page_size=20)
        assert result.total == 0
        assert result.items == []


class TestUnreadCountOut:
    def test_valid_count(self) -> None:
        result = UnreadCountOut(count=5)
        assert result.count == 5

    def test_zero_count(self) -> None:
        result = UnreadCountOut(count=0)
        assert result.count == 0


class TestNotificationPreference:
    def test_defaults(self) -> None:
        pref = NotificationPreference()
        assert pref.enabled is True
        assert pref.push is True

    def test_custom_values(self) -> None:
        pref = NotificationPreference(enabled=False, push=False)
        assert pref.enabled is False
        assert pref.push is False


class TestNotificationPreferencesOut:
    def test_defaults(self) -> None:
        prefs = NotificationPreferencesOut()
        assert prefs.trend_detected.enabled is True
        assert prefs.trend_detected.push is True
        assert prefs.content_published.enabled is True
        assert prefs.pipeline_stage_changed.enabled is False
        assert prefs.pipeline_stage_changed.push is False
        assert prefs.content_created.enabled is False
        assert prefs.content_created.push is False

    def test_from_dict(self) -> None:
        prefs = NotificationPreferencesOut(
            **{
                "trend_detected": {"enabled": False, "push": False},
            }
        )
        assert prefs.trend_detected.enabled is False
        assert prefs.trend_detected.push is False
        # Others keep defaults
        assert prefs.content_published.enabled is True


class TestNotificationPreferencesIn:
    def test_partial_update(self) -> None:
        inp = NotificationPreferencesIn(
            trend_detected=NotificationPreference(enabled=False, push=False)
        )
        dumped = inp.model_dump(exclude_none=True)
        assert "trend_detected" in dumped
        assert "content_published" not in dumped

    def test_all_none_by_default(self) -> None:
        inp = NotificationPreferencesIn()
        dumped = inp.model_dump(exclude_none=True)
        assert dumped == {}
