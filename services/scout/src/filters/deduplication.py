"""Trend deduplication using fuzzy string matching."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from thefuzz import fuzz

from src.providers.base import TrendResult

logger = structlog.get_logger(__name__)

# Default fuzzy match threshold (0-100); above this, trends are considered duplicates
DEFAULT_THRESHOLD = 85

# Number of days to look back for existing content when deduplicating
CONTENT_LOOKBACK_DAYS = 7


class TrendDeduplicator:
    """Deduplicates trend results using fuzzy string matching.

    Merges similar trends from different sources by keeping the highest-scoring
    variant. Skips trends that match existing content within the lookback window.
    """

    def __init__(
        self,
        threshold: int = DEFAULT_THRESHOLD,
        lookback_days: int = CONTENT_LOOKBACK_DAYS,
    ) -> None:
        self._threshold = threshold
        self._lookback_days = lookback_days

    def deduplicate(
        self,
        trends: list[TrendResult],
        existing_content_topics: list[dict[str, Any]] | None = None,
    ) -> list[TrendResult]:
        """Remove duplicate and near-duplicate trends.

        1. Skip trends matching existing content within the lookback window.
        2. Merge similar trends from different sources (keep highest score).
        3. Return the deduplicated list sorted by score descending.

        Args:
            trends: Raw trend results from all providers.
            existing_content_topics: List of dicts with ``topic`` (str) and
                ``created_at`` (datetime) keys representing recently created
                content to avoid re-covering.

        Returns:
            Deduplicated list of trends.
        """
        if not trends:
            return []

        existing = existing_content_topics or []

        # Phase 1: filter out trends matching recent content
        filtered = self._filter_existing_content(trends, existing)

        # Phase 2: merge similar trends from different sources
        merged = self._merge_similar(filtered)

        merged.sort(key=lambda t: t.score, reverse=True)

        logger.info(
            "deduplication_applied",
            input_count=len(trends),
            after_content_filter=len(filtered),
            output_count=len(merged),
            threshold=self._threshold,
        )

        return merged

    def _filter_existing_content(
        self,
        trends: list[TrendResult],
        existing: list[dict[str, Any]],
    ) -> list[TrendResult]:
        """Remove trends that fuzzy-match recently created content topics."""
        if not existing:
            return list(trends)

        cutoff = datetime.now(UTC) - timedelta(days=self._lookback_days)
        recent_topics: list[str] = []

        for item in existing:
            created_at = item.get("created_at")
            if isinstance(created_at, datetime):
                if created_at >= cutoff:
                    recent_topics.append(item.get("topic", "").lower())
            elif isinstance(created_at, str):
                try:
                    dt = datetime.fromisoformat(created_at)
                    if dt >= cutoff:
                        recent_topics.append(item.get("topic", "").lower())
                except ValueError:
                    continue

        if not recent_topics:
            return list(trends)

        result: list[TrendResult] = []
        for trend in trends:
            if self._matches_any(trend.topic.lower(), recent_topics):
                logger.debug(
                    "trend_skipped_existing_content",
                    topic=trend.topic,
                )
                continue
            result.append(trend)

        return result

    def _merge_similar(
        self, trends: list[TrendResult]
    ) -> list[TrendResult]:
        """Merge trends with similar topics, keeping the highest score."""
        if not trends:
            return []

        # Track which trends have been consumed by a merge
        consumed: set[int] = set()
        merged: list[TrendResult] = []

        for i, trend_a in enumerate(trends):
            if i in consumed:
                continue

            best = trend_a
            sources: set[str] = {trend_a.source}

            for j in range(i + 1, len(trends)):
                if j in consumed:
                    continue

                trend_b = trends[j]
                similarity = fuzz.token_sort_ratio(
                    trend_a.topic.lower(),
                    trend_b.topic.lower(),
                )

                if similarity >= self._threshold:
                    consumed.add(j)
                    sources.add(trend_b.source)
                    if trend_b.score > best.score:
                        best = trend_b

            # Build merged result with combined source info
            source_str = (
                best.source
                if len(sources) == 1
                else ",".join(sorted(sources))
            )
            raw = dict(best.raw_data) if best.raw_data else {}
            raw["merged_sources"] = sorted(sources)

            merged.append(
                TrendResult(
                    topic=best.topic,
                    score=best.score,
                    source=source_str,
                    raw_data=raw,
                )
            )

        return merged

    def _matches_any(self, topic: str, targets: list[str]) -> bool:
        """Check if topic fuzzy-matches any target string."""
        for target in targets:
            similarity = fuzz.token_sort_ratio(topic, target)
            if similarity >= self._threshold:
                return True
        return False
