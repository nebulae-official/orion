"""Google Trends provider using the official Trending RSS feed."""

from __future__ import annotations

import asyncio
import math
import xml.etree.ElementTree as ET
from typing import Any

import httpx
import structlog

from src.providers.base import TrendProvider, TrendResult

logger = structlog.get_logger(__name__)

# Default backoff parameters for rate limiting
_INITIAL_BACKOFF_SECS = 2.0
_MAX_RETRIES = 3
_BACKOFF_FACTOR = 2.0

_RSS_URL = "https://trends.google.com/trending/rss?geo={region}"
_HT_NS = "https://trends.google.com/trending/rss"


def _parse_traffic(raw: str) -> int:
    """Parse an approximate traffic string like '200+', '5,000+', '500K+' into an int."""
    text = raw.strip().rstrip("+").strip().replace(",", "")
    multiplier = 1
    if text.upper().endswith("K"):
        text = text[:-1]
        multiplier = 1_000
    elif text.upper().endswith("M"):
        text = text[:-1]
        multiplier = 1_000_000
    try:
        return int(float(text) * multiplier)
    except (ValueError, TypeError):
        return 0


def _traffic_to_score(traffic: int) -> float:
    """Convert a traffic number to a 0-100 score using log scaling."""
    return min(100.0, math.log10(max(traffic, 1)) * 20)


class GoogleTrendsProvider(TrendProvider):
    """Fetches trending searches from Google's official Trending RSS feed.

    Uses ``https://trends.google.com/trending/rss?geo={region}`` which
    returns XML with trending topics, traffic estimates, and news links.
    """

    def __init__(
        self,
        retries: int = _MAX_RETRIES,
        backoff_secs: float = _INITIAL_BACKOFF_SECS,
        timeout: float = 15.0,
    ) -> None:
        self._retries = retries
        self._backoff_secs = backoff_secs
        self._timeout = timeout

    async def fetch_trends(self, region: str = "US", limit: int = 20) -> list[TrendResult]:
        """Fetch daily trending searches from Google Trends RSS feed.

        Retries with exponential backoff on transient failures.
        """
        url = _RSS_URL.format(region=region)
        backoff = self._backoff_secs

        for attempt in range(1, self._retries + 1):
            try:
                results = await self._fetch_rss(url, region, limit)
                logger.info(
                    "google_trends_fetched",
                    region=region,
                    count=len(results),
                )
                return results
            except Exception:
                if attempt == self._retries:
                    logger.exception(
                        "google_trends_failed",
                        region=region,
                        attempt=attempt,
                    )
                    return []
                logger.warning(
                    "google_trends_retry",
                    region=region,
                    attempt=attempt,
                    backoff=backoff,
                )
                await asyncio.sleep(backoff)
                backoff *= _BACKOFF_FACTOR

        return []  # pragma: no cover

    async def _fetch_rss(self, url: str, region: str, limit: int) -> list[TrendResult]:
        """Fetch and parse the Google Trends RSS feed."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url)
            response.raise_for_status()

        root = ET.fromstring(response.text)
        ns = {"ht": _HT_NS}

        results: list[TrendResult] = []
        for item in root.iter("item"):
            if len(results) >= limit:
                break

            title_el = item.find("title")
            if title_el is None or not title_el.text:
                continue
            topic = title_el.text.strip()

            # Parse traffic estimate
            traffic_el = item.find("ht:approx_traffic", ns)
            traffic_raw = (
                traffic_el.text.strip() if traffic_el is not None and traffic_el.text else "0"
            )
            traffic = _parse_traffic(traffic_raw)
            score = round(_traffic_to_score(traffic), 2)

            # Parse publication date
            pub_date_el = item.find("pubDate")
            pub_date = (
                pub_date_el.text.strip() if pub_date_el is not None and pub_date_el.text else None
            )

            # Collect news items
            news_items: list[dict[str, str]] = []
            for news in item.findall("ht:news_item", ns):
                news_title_el = news.find("ht:news_item_title", ns)
                news_url_el = news.find("ht:news_item_url", ns)
                entry: dict[str, str] = {}
                if news_title_el is not None and news_title_el.text:
                    entry["title"] = news_title_el.text.strip()
                if news_url_el is not None and news_url_el.text:
                    entry["url"] = news_url_el.text.strip()
                if entry:
                    news_items.append(entry)

            # Picture URL
            picture_el = item.find("ht:picture", ns)
            picture = (
                picture_el.text.strip() if picture_el is not None and picture_el.text else None
            )

            raw_data: dict[str, Any] = {
                "region": region,
                "traffic": traffic_raw,
            }
            if pub_date:
                raw_data["pub_date"] = pub_date
            if news_items:
                raw_data["news_items"] = news_items
            if picture:
                raw_data["picture"] = picture

            results.append(
                TrendResult(
                    topic=topic,
                    score=score,
                    source="google_trends_daily",
                    raw_data=raw_data,
                )
            )

        return results
