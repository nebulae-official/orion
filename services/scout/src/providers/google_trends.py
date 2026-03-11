"""Google Trends provider using the pytrends library."""

from __future__ import annotations

import asyncio
from typing import Any

import structlog
from pytrends.request import TrendReq

from src.providers.base import TrendProvider, TrendResult

logger = structlog.get_logger(__name__)

# Default backoff parameters for rate limiting
_INITIAL_BACKOFF_SECS = 2.0
_MAX_RETRIES = 3
_BACKOFF_FACTOR = 2.0


class GoogleTrendsProvider(TrendProvider):
    """Fetches trending searches from Google Trends via pytrends.

    Uses ``trending_searches`` for daily trending topics and falls back
    gracefully when the upstream API rate-limits or errors.
    """

    def __init__(
        self,
        hl: str = "en-US",
        tz: int = 360,
        retries: int = _MAX_RETRIES,
        backoff_secs: float = _INITIAL_BACKOFF_SECS,
    ) -> None:
        self._hl = hl
        self._tz = tz
        self._retries = retries
        self._backoff_secs = backoff_secs

    def _build_client(self) -> TrendReq:
        """Create a fresh pytrends client (not thread-safe, so per-call)."""
        return TrendReq(hl=self._hl, tz=self._tz)

    async def fetch_trends(
        self, region: str = "US", limit: int = 20
    ) -> list[TrendResult]:
        """Fetch daily trending searches from Google Trends.

        Runs the synchronous pytrends calls in a thread-pool executor
        to keep the event loop responsive.  Retries with exponential
        backoff on transient failures.
        """
        loop = asyncio.get_running_loop()
        backoff = self._backoff_secs

        for attempt in range(1, self._retries + 1):
            try:
                results = await loop.run_in_executor(
                    None, self._fetch_sync, region, limit
                )
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

    # ------------------------------------------------------------------
    # Synchronous helpers (executed in thread-pool)
    # ------------------------------------------------------------------

    def _fetch_sync(self, region: str, limit: int) -> list[TrendResult]:
        """Synchronous Google Trends fetch (runs in executor)."""
        client = self._build_client()
        results: list[TrendResult] = []

        # Daily trending searches
        results.extend(self._fetch_daily_trends(client, region, limit))

        # Real-time trending searches (supplementary)
        if len(results) < limit:
            remaining = limit - len(results)
            results.extend(
                self._fetch_realtime_trends(client, region, remaining)
            )

        return results[:limit]

    def _fetch_daily_trends(
        self, client: TrendReq, region: str, limit: int
    ) -> list[TrendResult]:
        """Fetch daily trending searches."""
        try:
            df = client.trending_searches(pn=region)
            trends: list[TrendResult] = []
            for idx, row in df.head(limit).iterrows():
                topic = str(row.iloc[0]) if hasattr(row, "iloc") else str(row[0])
                # Score is rank-based: top result gets 100, linearly decreasing
                score = max(0.0, 100.0 - (float(idx) * (100.0 / max(limit, 1))))
                trends.append(
                    TrendResult(
                        topic=topic,
                        score=round(score, 2),
                        source="google_trends_daily",
                        raw_data={"rank": int(idx), "region": region},
                    )
                )
            return trends
        except Exception:
            logger.exception("google_daily_trends_error", region=region)
            return []

    def _fetch_realtime_trends(
        self, client: TrendReq, region: str, limit: int
    ) -> list[TrendResult]:
        """Fetch real-time trending searches (best-effort)."""
        try:
            df = client.realtime_trending_searches(pn=region)
            trends: list[TrendResult] = []
            # realtime_trending_searches returns a DataFrame with 'title' column
            title_col = "title" if "title" in df.columns else df.columns[0]
            for idx, row in df.head(limit).iterrows():
                topic = str(row[title_col])
                score = max(0.0, 80.0 - (float(idx) * (80.0 / max(limit, 1))))
                trends.append(
                    TrendResult(
                        topic=topic,
                        score=round(score, 2),
                        source="google_trends_realtime",
                        raw_data={
                            "rank": int(idx),
                            "region": region,
                            "type": "realtime",
                        },
                    )
                )
            return trends
        except Exception:
            logger.warning("google_realtime_trends_unavailable", region=region)
            return []
