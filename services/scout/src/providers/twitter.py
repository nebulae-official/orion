"""X (Twitter) trend verification provider using tweepy AsyncClient."""

from __future__ import annotations

import os
import time
from typing import Any

import structlog
import tweepy

from src.providers.base import TrendProvider, TrendResult

logger = structlog.get_logger(__name__)

# Time windows (in seconds) for velocity calculation
_VELOCITY_WINDOWS = [
    ("1h", 3600),
    ("6h", 21600),
    ("24h", 86400),
]

# Minimum tweet count to consider a topic as trending
_MIN_TWEET_THRESHOLD = 50

# Weight factors for velocity scoring
_VELOCITY_WEIGHT = 0.6
_VOLUME_WEIGHT = 0.4

# Maximum score a topic can receive
_MAX_SCORE = 100.0


class TwitterProvider(TrendProvider):
    """Verifies and enriches trends using the X (Twitter) API v2.

    Uses tweepy AsyncClient to search recent tweets and count tweet volumes
    to calculate a velocity-based trend score. This provider is designed to
    cross-reference signals from other providers (Google Trends, RSS) to
    confirm whether a topic is genuinely gaining traction on X.
    """

    def __init__(
        self,
        bearer_token: str | None = None,
        existing_trends: list[TrendResult] | None = None,
    ) -> None:
        self._bearer_token = bearer_token or os.getenv("TWITTER_BEARER_TOKEN", "")
        self._client: tweepy.AsyncClient | None = None
        self._existing_trends = existing_trends or []

    def set_existing_trends(self, trends: list[TrendResult]) -> None:
        """Update the list of existing trends for cross-referencing."""
        self._existing_trends = trends

    def _get_client(self) -> tweepy.AsyncClient:
        """Return the tweepy async client, creating it on first use."""
        if self._client is None:
            self._client = tweepy.AsyncClient(
                bearer_token=self._bearer_token,
                wait_on_rate_limit=True,
            )
        return self._client

    async def fetch_trends(
        self, region: str = "US", limit: int = 20
    ) -> list[TrendResult]:
        """Fetch and verify trends from X using recent tweet search.

        Queries X API v2 for each existing trend topic, calculates velocity
        scores based on tweet volume over time windows, and cross-references
        with existing trend scores for confirmation.

        Args:
            region: Geographic region code (e.g. "US", "GB").
            limit: Maximum number of trends to return.

        Returns:
            List of verified trend results ordered by score descending.
        """
        if not self._bearer_token:
            logger.warning("twitter_bearer_token_missing")
            return []

        client = self._get_client()
        results: list[TrendResult] = []

        # Build topics to verify: use existing trends or fall back to search
        topics_to_check = self._get_topics_to_verify(limit)

        for topic in topics_to_check:
            try:
                score = await self._calculate_trend_score(client, topic, region)
                if score > 0:
                    results.append(
                        TrendResult(
                            topic=topic,
                            score=round(min(score, _MAX_SCORE), 2),
                            source="twitter_v2",
                            raw_data={
                                "region": region,
                                "verified": True,
                                "cross_referenced": self._is_cross_referenced(topic),
                            },
                        )
                    )
            except tweepy.TweepyException:
                logger.exception(
                    "twitter_topic_check_failed",
                    topic=topic,
                )

        # Sort by score descending
        results.sort(key=lambda t: t.score, reverse=True)
        results = results[:limit]

        logger.info(
            "twitter_trends_fetched",
            region=region,
            verified_count=len(results),
        )
        return results

    def _get_topics_to_verify(self, limit: int) -> list[str]:
        """Extract topics from existing trends to verify on X."""
        if self._existing_trends:
            return [t.topic for t in self._existing_trends[:limit]]
        return []

    def _is_cross_referenced(self, topic: str) -> bool:
        """Check if a topic exists in existing trends from other sources."""
        topic_lower = topic.lower()
        return any(
            topic_lower in t.topic.lower() or t.topic.lower() in topic_lower
            for t in self._existing_trends
        )

    async def _calculate_trend_score(
        self,
        client: tweepy.AsyncClient,
        topic: str,
        region: str,
    ) -> float:
        """Calculate a velocity-based trend score for a topic.

        Combines tweet volume with velocity (rate of change across time
        windows) to produce a 0-100 score.

        Args:
            client: Tweepy async client.
            topic: The topic to score.
            region: Geographic region code.

        Returns:
            Trend score between 0 and 100.
        """
        # Get recent tweet counts across time windows
        volumes = await self._get_tweet_volumes(client, topic)

        if not volumes:
            return 0.0

        # Calculate velocity score from volume changes across windows
        velocity_score = self._compute_velocity_score(volumes)

        # Calculate volume score (normalized)
        total_volume = sum(volumes.values())
        if total_volume < _MIN_TWEET_THRESHOLD:
            return 0.0

        # Normalize volume to 0-100 scale (log-based for large ranges)
        import math

        volume_score = min(100.0, math.log10(max(total_volume, 1)) * 25.0)

        # Combine velocity and volume
        combined = (
            velocity_score * _VELOCITY_WEIGHT
            + volume_score * _VOLUME_WEIGHT
        )

        # Cross-reference bonus: boost score if confirmed by other sources
        if self._is_cross_referenced(topic):
            combined = min(_MAX_SCORE, combined * 1.2)

        return combined

    async def _get_tweet_volumes(
        self,
        client: tweepy.AsyncClient,
        topic: str,
    ) -> dict[str, int]:
        """Query tweet counts for a topic across different time windows.

        Args:
            client: Tweepy async client.
            topic: Search query string.

        Returns:
            Dict mapping window label to tweet count.
        """
        volumes: dict[str, int] = {}

        try:
            # Use search_recent_tweets to gauge volume
            response = await client.search_recent_tweets(
                query=f'"{topic}" -is:retweet lang:en',
                max_results=100,
                tweet_fields=["created_at"],
            )

            if response.data is None:
                return volumes

            now = time.time()

            for label, window_secs in _VELOCITY_WINDOWS:
                cutoff = now - window_secs
                count = sum(
                    1
                    for tweet in response.data
                    if tweet.created_at
                    and tweet.created_at.timestamp() >= cutoff
                )
                volumes[label] = count

        except tweepy.TweepyException:
            logger.exception("twitter_volume_query_failed", topic=topic)

        return volumes

    @staticmethod
    def _compute_velocity_score(volumes: dict[str, int]) -> float:
        """Compute velocity score from tweet volumes across time windows.

        Higher velocity (more recent tweets vs. older) means the topic
        is accelerating in interest.

        Args:
            volumes: Dict mapping window label to tweet count.

        Returns:
            Velocity score between 0 and 100.
        """
        hour_1 = volumes.get("1h", 0)
        hour_6 = volumes.get("6h", 0)
        hour_24 = volumes.get("24h", 0)

        if hour_24 == 0:
            return 0.0

        # Ratio of recent (1h) to total (24h) activity — high ratio means accelerating
        recency_ratio = hour_1 / hour_24 if hour_24 > 0 else 0.0

        # Ratio of medium (6h) to total (24h) — helps smooth out spikes
        medium_ratio = hour_6 / hour_24 if hour_24 > 0 else 0.0

        # Combine: strong recent activity with sustained medium-term growth
        velocity = (recency_ratio * 60.0) + (medium_ratio * 40.0)

        return min(100.0, velocity)
