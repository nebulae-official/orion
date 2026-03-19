"""RSS feed provider for trending topic detection."""

from __future__ import annotations

import asyncio
from typing import Any

import feedparser
import structlog

from src.providers.base import TrendProvider, TrendResult

logger = structlog.get_logger(__name__)

# Default RSS feeds targeting tech news
DEFAULT_FEEDS: list[str] = [
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB",
    "https://hnrss.org/frontpage",
    "https://www.reddit.com/r/technology/.rss",
]


class RSSProvider(TrendProvider):
    """Fetches trends from configurable RSS feeds.

    Parses feed entries and converts titles into :class:`TrendResult`
    objects.  Scoring is based on entry position within the feed
    (earlier = higher score).
    """

    def __init__(self, feed_urls: list[str] | None = None) -> None:
        self._feed_urls = feed_urls or DEFAULT_FEEDS

    async def fetch_trends(self, region: str = "US", limit: int = 20) -> list[TrendResult]:
        """Fetch trending topics from all configured RSS feeds.

        Runs synchronous feedparser calls in a thread-pool executor.
        """
        loop = asyncio.get_running_loop()
        all_results: list[TrendResult] = []

        for url in self._feed_urls:
            try:
                results = await loop.run_in_executor(None, self._parse_feed, url, limit)
                all_results.extend(results)
            except Exception:
                logger.exception("rss_feed_error", url=url)

        # Deduplicate by topic (case-insensitive), keep highest score
        seen: dict[str, TrendResult] = {}
        for result in all_results:
            key = result.topic.lower().strip()
            if key not in seen or result.score > seen[key].score:
                seen[key] = result

        deduped = sorted(seen.values(), key=lambda r: r.score, reverse=True)
        logger.info("rss_trends_fetched", count=len(deduped))
        return deduped[:limit]

    def _parse_feed(self, url: str, limit: int) -> list[TrendResult]:
        """Parse a single RSS feed synchronously."""
        feed = feedparser.parse(url)

        if feed.bozo and not feed.entries:
            logger.warning("rss_feed_parse_error", url=url, error=str(feed.bozo_exception))
            return []

        results: list[TrendResult] = []
        feed_title = feed.feed.get("title", url)

        for idx, entry in enumerate(feed.entries[:limit]):
            title = entry.get("title", "").strip()
            if not title:
                continue

            # Score based on position: top entries score highest
            score = max(0.0, 70.0 - (float(idx) * (70.0 / max(limit, 1))))

            raw_data: dict[str, Any] = {
                "feed": feed_title,
                "url": entry.get("link", ""),
                "published": entry.get("published", ""),
                "rank": idx,
            }

            results.append(
                TrendResult(
                    topic=title,
                    score=round(score, 2),
                    source=f"rss:{feed_title}",
                    raw_data=raw_data,
                )
            )

        return results
