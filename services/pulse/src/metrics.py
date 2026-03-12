"""Prometheus metrics for the Pulse service."""

from __future__ import annotations

from prometheus_client import Counter

TRENDS_FOUND = Counter(
    "orion_trends_found_total",
    "Number of trends discovered",
    ["source"],
)

TRENDS_USED = Counter(
    "orion_trends_used_total",
    "Number of trends converted to content",
    ["source"],
)

TRENDS_DISCARDED = Counter(
    "orion_trends_discarded_total",
    "Number of trends filtered out",
    ["source", "reason"],
)
