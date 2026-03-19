"""Niche-based trend filtering and score adjustment."""

from __future__ import annotations

import structlog
from pydantic import BaseModel, Field

from src.providers.base import TrendResult

logger = structlog.get_logger(__name__)


class NicheConfig(BaseModel):
    """Configuration for niche-based trend filtering.

    Keyword matches boost a trend's score while excluded topics reduce it.
    Trends below ``min_score`` after adjustment are dropped.
    """

    keywords: list[str] = Field(
        default_factory=list,
        description="Keywords that boost a trend's score when matched",
    )
    excluded_topics: list[str] = Field(
        default_factory=list,
        description="Topics or keywords that reduce a trend's score",
    )
    min_score: float = Field(
        default=10.0,
        ge=0.0,
        le=100.0,
        description="Minimum score threshold after adjustments",
    )
    categories: list[str] = Field(
        default_factory=list,
        description="Content categories this niche targets",
    )


# Pre-built configs for common niches
DEFAULT_NICHE_CONFIGS: dict[str, NicheConfig] = {
    "tech": NicheConfig(
        keywords=[
            "AI",
            "artificial intelligence",
            "machine learning",
            "startup",
            "software",
            "programming",
            "developer",
            "cloud",
            "SaaS",
            "API",
            "open source",
            "cybersecurity",
            "blockchain",
            "robotics",
            "GPU",
        ],
        excluded_topics=[
            "celebrity",
            "gossip",
            "horoscope",
            "reality TV",
        ],
        min_score=15.0,
        categories=["technology", "software", "AI"],
    ),
    "gaming": NicheConfig(
        keywords=[
            "game",
            "gaming",
            "esports",
            "PlayStation",
            "Xbox",
            "Nintendo",
            "Steam",
            "Twitch",
            "streamer",
            "GPU",
            "console",
            "PC gaming",
            "indie game",
            "RPG",
            "FPS",
        ],
        excluded_topics=[
            "gambling",
            "casino",
            "lottery",
        ],
        min_score=15.0,
        categories=["gaming", "esports", "entertainment"],
    ),
    "finance": NicheConfig(
        keywords=[
            "stock",
            "market",
            "crypto",
            "bitcoin",
            "ethereum",
            "investing",
            "fintech",
            "banking",
            "economy",
            "inflation",
            "interest rate",
            "IPO",
            "earnings",
            "trading",
            "DeFi",
        ],
        excluded_topics=[
            "scam",
            "ponzi",
            "get rich quick",
        ],
        min_score=20.0,
        categories=["finance", "investing", "cryptocurrency"],
    ),
    "health": NicheConfig(
        keywords=[
            "health",
            "fitness",
            "nutrition",
            "mental health",
            "wellness",
            "medical",
            "research",
            "clinical trial",
            "FDA",
            "vaccine",
            "exercise",
            "diet",
            "sleep",
            "mindfulness",
            "therapy",
        ],
        excluded_topics=[
            "miracle cure",
            "detox cleanse",
            "anti-vax",
        ],
        min_score=15.0,
        categories=["health", "fitness", "wellness"],
    ),
}

# Score adjustment constants
_KEYWORD_BOOST = 15.0
_EXCLUSION_PENALTY = 30.0


class NicheFilter:
    """Filters and adjusts trend scores based on niche configuration."""

    def filter_trends(self, trends: list[TrendResult], config: NicheConfig) -> list[TrendResult]:
        """Apply niche filtering to a list of trends.

        1. Boost score for keyword matches.
        2. Reduce score for excluded topic matches.
        3. Drop trends below the minimum score threshold.

        Args:
            trends: Raw trend results from providers.
            config: Niche configuration for filtering.

        Returns:
            Filtered and score-adjusted trends, sorted by score descending.
        """
        filtered: list[TrendResult] = []

        keywords_lower = [kw.lower() for kw in config.keywords]
        excluded_lower = [ex.lower() for ex in config.excluded_topics]

        for trend in trends:
            topic_lower = trend.topic.lower()
            adjusted_score = trend.score

            # Boost for keyword matches
            keyword_matches = sum(1 for kw in keywords_lower if kw in topic_lower)
            if keyword_matches > 0:
                adjusted_score += _KEYWORD_BOOST * keyword_matches

            # Penalty for excluded topic matches
            exclusion_matches = sum(1 for ex in excluded_lower if ex in topic_lower)
            if exclusion_matches > 0:
                adjusted_score -= _EXCLUSION_PENALTY * exclusion_matches

            # Clamp to valid range
            adjusted_score = max(0.0, min(100.0, adjusted_score))

            if adjusted_score < config.min_score:
                continue

            filtered.append(
                TrendResult(
                    topic=trend.topic,
                    score=round(adjusted_score, 2),
                    source=trend.source,
                    raw_data=trend.raw_data,
                )
            )

        filtered.sort(key=lambda t: t.score, reverse=True)
        logger.info(
            "niche_filter_applied",
            input_count=len(trends),
            output_count=len(filtered),
        )
        return filtered
