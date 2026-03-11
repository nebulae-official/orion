"""Trend data providers for the Scout service."""

from src.providers.base import TrendProvider, TrendResult
from src.providers.google_trends import GoogleTrendsProvider
from src.providers.rss import RSSProvider

__all__ = [
    "GoogleTrendsProvider",
    "RSSProvider",
    "TrendProvider",
    "TrendResult",
]
