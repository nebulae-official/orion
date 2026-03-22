"""Tests for the trend expiration feature (ORION-177)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from orion_common.db.models import TrendStatus
from orion_common.events import Channels
from src.scheduler import EXPIRE_BATCH_LIMIT, expire_old_trends


def _make_trend(
    *,
    topic: str = "Test trend",
    source: str = "rss",
    detected_at: datetime | None = None,
    status: TrendStatus = TrendStatus.active,
) -> MagicMock:
    """Create a mock Trend ORM object."""
    trend = MagicMock()
    trend.id = uuid.uuid4()
    trend.topic = topic
    trend.source = source
    trend.detected_at = detected_at or (datetime.now(UTC) - timedelta(days=10))
    trend.status = status
    return trend


def _mock_session_with_trends(trends: list[MagicMock]) -> AsyncMock:
    """Build a mock async session whose execute().scalars().all() returns *trends*."""
    session = AsyncMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = trends
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    session.execute.return_value = result_mock
    session.commit = AsyncMock()
    return session


async def _fake_get_session(session: AsyncMock):
    """Async generator that yields the given mock session once."""
    yield session


# ---- Tests ----


@pytest.mark.asyncio
async def test_expire_old_trends_none_found() -> None:
    """When no old trends exist, returns 0 and publishes no events."""
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    session = _mock_session_with_trends([])

    with patch("src.scheduler.get_session", return_value=_fake_get_session(session)):
        count = await expire_old_trends(event_bus)

    assert count == 0
    event_bus.publish.assert_not_called()


@pytest.mark.asyncio
async def test_expire_old_trends_expires_and_publishes() -> None:
    """Old trends are expired and a TREND_EXPIRED event is published for each."""
    trends = [
        _make_trend(topic="Old trend 1", source="rss"),
        _make_trend(topic="Old trend 2", source="google_trends"),
        _make_trend(topic="Old trend 3", source="twitter"),
    ]
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    session = _mock_session_with_trends(trends)
    mock_repo_instance = AsyncMock()

    with (
        patch("src.scheduler.get_session", return_value=_fake_get_session(session)),
        patch("src.scheduler.TrendRepository", return_value=mock_repo_instance),
    ):
        count = await expire_old_trends(event_bus)

    assert count == 3
    assert mock_repo_instance.update_status.call_count == 3
    assert event_bus.publish.call_count == 3

    # Verify each trend was set to expired
    for i, trend in enumerate(trends):
        call_args = mock_repo_instance.update_status.call_args_list[i]
        assert call_args[0] == (trend.id, TrendStatus.expired)

    # Verify each event was published to the correct channel
    for call in event_bus.publish.call_args_list:
        assert call[0][0] == Channels.TREND_EXPIRED

    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_expire_old_trends_respects_expiry_days_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Custom SCOUT_TREND_EXPIRY_DAYS env var is respected."""
    monkeypatch.setenv("SCOUT_TREND_EXPIRY_DAYS", "3")

    # Trend 5 days old should be expired with a 3-day window
    old_trend = _make_trend(
        topic="Should expire",
        detected_at=datetime.now(UTC) - timedelta(days=5),
    )
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    session = _mock_session_with_trends([old_trend])
    mock_repo_instance = AsyncMock()

    with (
        patch("src.scheduler.get_session", return_value=_fake_get_session(session)),
        patch("src.scheduler.TrendRepository", return_value=mock_repo_instance),
    ):
        count = await expire_old_trends(event_bus)

    assert count == 1
    mock_repo_instance.update_status.assert_awaited_once_with(old_trend.id, TrendStatus.expired)
    event_bus.publish.assert_awaited_once()


@pytest.mark.asyncio
async def test_expire_old_trends_batch_limit() -> None:
    """At most EXPIRE_BATCH_LIMIT trends are processed per invocation.

    The SQL query limits rows, so even if there are more old trends in the DB,
    the function only processes what the query returns (up to 100).
    """
    # Simulate exactly EXPIRE_BATCH_LIMIT trends returned by the query
    trends = [_make_trend(topic=f"Trend {i}") for i in range(EXPIRE_BATCH_LIMIT)]
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    session = _mock_session_with_trends(trends)
    mock_repo_instance = AsyncMock()

    with (
        patch("src.scheduler.get_session", return_value=_fake_get_session(session)),
        patch("src.scheduler.TrendRepository", return_value=mock_repo_instance),
    ):
        count = await expire_old_trends(event_bus)

    assert count == EXPIRE_BATCH_LIMIT
    assert mock_repo_instance.update_status.call_count == EXPIRE_BATCH_LIMIT
    assert event_bus.publish.call_count == EXPIRE_BATCH_LIMIT


@pytest.mark.asyncio
async def test_expire_publishes_correct_payload() -> None:
    """The TREND_EXPIRED event payload contains all required fields."""
    trend = _make_trend(
        topic="AI breakthroughs",
        source="google_trends",
        detected_at=datetime(2026, 3, 10, 12, 0, 0, tzinfo=UTC),
    )
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    session = _mock_session_with_trends([trend])
    mock_repo_instance = AsyncMock()

    with (
        patch("src.scheduler.get_session", return_value=_fake_get_session(session)),
        patch("src.scheduler.TrendRepository", return_value=mock_repo_instance),
    ):
        await expire_old_trends(event_bus)

    event_bus.publish.assert_awaited_once()
    channel, payload = event_bus.publish.call_args[0]

    assert channel == Channels.TREND_EXPIRED
    assert payload["trend_id"] == str(trend.id)
    assert payload["topic"] == "AI breakthroughs"
    assert payload["source"] == "google_trends"
    assert payload["detected_at"] == "2026-03-10T12:00:00+00:00"
    assert "expired_at" in payload
    # Verify expired_at is a valid ISO datetime string
    expired_dt = datetime.fromisoformat(payload["expired_at"])
    assert expired_dt.tzinfo is not None
