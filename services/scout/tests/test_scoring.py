"""Tests for trend scoring and niche filtering logic."""

from __future__ import annotations

import pytest
from src.filters.niche_filter import _KEYWORD_BOOST, NicheConfig, NicheFilter
from src.providers.base import TrendResult


@pytest.fixture
def niche_filter() -> NicheFilter:
    return NicheFilter()


@pytest.fixture
def tech_config() -> NicheConfig:
    return NicheConfig(
        keywords=["AI", "machine learning", "startup"],
        excluded_topics=["celebrity", "gossip"],
        min_score=15.0,
        categories=["technology"],
    )


class TestNicheFilter:
    """Tests for NicheFilter.filter_trends()."""

    def test_keyword_boost_increases_score(
        self, niche_filter: NicheFilter, tech_config: NicheConfig
    ) -> None:
        """Trends matching keywords receive a score boost."""
        trends = [TrendResult(topic="AI startup launches", score=20.0, source="rss")]
        result = niche_filter.filter_trends(trends, tech_config)
        assert len(result) == 1
        # "AI" and "startup" both match → 2 * _KEYWORD_BOOST
        assert result[0].score == min(100.0, 20.0 + 2 * _KEYWORD_BOOST)

    def test_exclusion_penalty_reduces_score(
        self, niche_filter: NicheFilter, tech_config: NicheConfig
    ) -> None:
        """Trends matching excluded topics receive a penalty."""
        trends = [TrendResult(topic="Celebrity gossip trending", score=50.0, source="twitter")]
        result = niche_filter.filter_trends(trends, tech_config)
        # "celebrity" and "gossip" both match → 2 * _EXCLUSION_PENALTY = 60
        # 50 - 60 = -10, clamped to 0, below min_score 15 → filtered out
        assert len(result) == 0

    def test_min_score_threshold(self, niche_filter: NicheFilter, tech_config: NicheConfig) -> None:
        """Trends below min_score are dropped."""
        trends = [TrendResult(topic="Random topic", score=10.0, source="rss")]
        result = niche_filter.filter_trends(trends, tech_config)
        assert len(result) == 0

    def test_results_sorted_by_score_descending(
        self, niche_filter: NicheFilter, tech_config: NicheConfig
    ) -> None:
        """Output is sorted by adjusted score, highest first."""
        trends = [
            TrendResult(topic="Small startup news", score=20.0, source="rss"),
            TrendResult(topic="AI machine learning deep dive", score=30.0, source="google"),
        ]
        result = niche_filter.filter_trends(trends, tech_config)
        assert len(result) == 2
        assert result[0].score >= result[1].score

    def test_empty_trends_returns_empty(
        self, niche_filter: NicheFilter, tech_config: NicheConfig
    ) -> None:
        """Empty input returns empty output."""
        result = niche_filter.filter_trends([], tech_config)
        assert result == []

    def test_score_clamped_to_100(self, niche_filter: NicheFilter) -> None:
        """Score is clamped to a maximum of 100."""
        config = NicheConfig(
            keywords=["AI", "machine learning", "startup", "cloud"],
            min_score=0.0,
        )
        trend = TrendResult(
            topic="AI machine learning startup cloud platform",
            score=95.0,
            source="rss",
        )
        result = niche_filter.filter_trends([trend], config)
        assert len(result) == 1
        assert result[0].score <= 100.0

    def test_score_clamped_to_zero(self, niche_filter: NicheFilter) -> None:
        """Score is clamped to a minimum of 0."""
        config = NicheConfig(
            excluded_topics=["bad", "terrible", "awful"],
            min_score=0.0,
        )
        trend = TrendResult(
            topic="bad terrible awful day",
            score=10.0,
            source="rss",
        )
        result = niche_filter.filter_trends([trend], config)
        # 10 - 3*30 = -80 → clamped to 0, passes min_score=0
        assert len(result) == 1
        assert result[0].score == 0.0
