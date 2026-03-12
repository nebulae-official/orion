"""Tests for trend provider scrapers (RSS, deduplication)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from src.filters.deduplication import TrendDeduplicator
from src.providers.base import TrendResult
from src.providers.rss import RSSProvider


class TestRSSProvider:
    """Unit tests for the RSS trend provider."""

    @pytest.mark.asyncio
    async def test_fetch_trends_returns_results(self) -> None:
        """fetch_trends returns TrendResult objects from parsed feeds."""
        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Test Feed"}
        mock_feed.entries = [
            {"title": "AI Revolution", "link": "http://example.com/1", "published": "2024-01-01"},
            {"title": "New GPU Launch", "link": "http://example.com/2", "published": "2024-01-02"},
        ]

        provider = RSSProvider(feed_urls=["http://fake.feed/rss"])
        with patch("src.providers.rss.feedparser.parse", return_value=mock_feed):
            results = await provider.fetch_trends(region="US", limit=10)

        assert len(results) == 2
        assert results[0].source.startswith("rss:")
        assert results[0].topic == "AI Revolution"

    @pytest.mark.asyncio
    async def test_fetch_trends_empty_feed(self) -> None:
        """Empty feed returns no results."""
        mock_feed = MagicMock()
        mock_feed.bozo = True
        mock_feed.entries = []
        mock_feed.bozo_exception = Exception("Parse error")
        mock_feed.feed = {"title": "Broken Feed"}

        provider = RSSProvider(feed_urls=["http://fake.feed/rss"])
        with patch("src.providers.rss.feedparser.parse", return_value=mock_feed):
            results = await provider.fetch_trends()

        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_fetch_trends_deduplicates_by_topic(self) -> None:
        """Duplicate topics across feeds are merged (highest score kept)."""
        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Feed A"}
        mock_feed.entries = [
            {"title": "AI News", "link": "http://a.com/1"},
            {"title": "AI News", "link": "http://a.com/2"},
        ]

        provider = RSSProvider(feed_urls=["http://fake.feed/rss"])
        with patch("src.providers.rss.feedparser.parse", return_value=mock_feed):
            results = await provider.fetch_trends()

        # Duplicates by topic are merged
        topics = [r.topic for r in results]
        assert topics.count("AI News") == 1

    @pytest.mark.asyncio
    async def test_fetch_trends_respects_limit(self) -> None:
        """Result count respects the limit parameter."""
        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Big Feed"}
        mock_feed.entries = [
            {"title": f"Topic {i}", "link": f"http://a.com/{i}"} for i in range(50)
        ]

        provider = RSSProvider(feed_urls=["http://fake.feed/rss"])
        with patch("src.providers.rss.feedparser.parse", return_value=mock_feed):
            results = await provider.fetch_trends(limit=5)

        assert len(results) <= 5

    @pytest.mark.asyncio
    async def test_score_decreases_with_position(self) -> None:
        """Earlier entries in the feed score higher than later ones."""
        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Test Feed"}
        mock_feed.entries = [
            {"title": f"Topic {i}", "link": f"http://a.com/{i}"} for i in range(10)
        ]

        provider = RSSProvider(feed_urls=["http://fake.feed/rss"])
        with patch("src.providers.rss.feedparser.parse", return_value=mock_feed):
            results = await provider.fetch_trends(limit=10)

        # First result should have a higher score than last
        assert results[0].score > results[-1].score


class TestTrendDeduplicator:
    """Unit tests for the TrendDeduplicator."""

    def test_empty_input(self) -> None:
        """Empty trend list returns empty."""
        dedup = TrendDeduplicator()
        assert dedup.deduplicate([]) == []

    def test_merge_similar_topics(self) -> None:
        """Near-duplicate topics from different sources are merged."""
        dedup = TrendDeduplicator(threshold=80)
        trends = [
            TrendResult(topic="AI coding assistant", score=80.0, source="rss"),
            TrendResult(topic="AI Coding Assistants", score=90.0, source="twitter"),
        ]
        result = dedup.deduplicate(trends)
        assert len(result) == 1
        assert result[0].score == 90.0  # highest score kept

    def test_distinct_topics_preserved(self) -> None:
        """Unrelated topics are not merged."""
        dedup = TrendDeduplicator()
        trends = [
            TrendResult(topic="AI revolution", score=80.0, source="rss"),
            TrendResult(topic="New smartphone release", score=70.0, source="twitter"),
        ]
        result = dedup.deduplicate(trends)
        assert len(result) == 2

    def test_filters_existing_content(self) -> None:
        """Trends matching recent content are excluded."""
        dedup = TrendDeduplicator(threshold=85)
        trends = [
            TrendResult(topic="AI coding assistants", score=80.0, source="rss"),
            TrendResult(topic="New topic entirely", score=70.0, source="twitter"),
        ]
        existing = [
            {
                "topic": "AI coding assistants review",
                "created_at": datetime.now(timezone.utc) - timedelta(days=1),
            }
        ]
        result = dedup.deduplicate(trends, existing_content_topics=existing)
        # The AI coding assistants topic should be filtered
        assert len(result) == 1
        assert result[0].topic == "New topic entirely"

    def test_old_content_not_filtered(self) -> None:
        """Content older than lookback window does not filter trends."""
        dedup = TrendDeduplicator(lookback_days=7)
        trends = [
            TrendResult(topic="AI coding assistants", score=80.0, source="rss"),
        ]
        existing = [
            {
                "topic": "AI coding assistants",
                "created_at": datetime.now(timezone.utc) - timedelta(days=30),
            }
        ]
        result = dedup.deduplicate(trends, existing_content_topics=existing)
        assert len(result) == 1

    def test_results_sorted_by_score(self) -> None:
        """Output is sorted by score descending."""
        dedup = TrendDeduplicator()
        trends = [
            TrendResult(topic="Low score topic", score=20.0, source="rss"),
            TrendResult(topic="High score topic", score=90.0, source="twitter"),
            TrendResult(topic="Mid score topic", score=50.0, source="google"),
        ]
        result = dedup.deduplicate(trends)
        scores = [r.score for r in result]
        assert scores == sorted(scores, reverse=True)
