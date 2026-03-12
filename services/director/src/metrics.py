"""Prometheus custom metrics for the Director service."""

from prometheus_client import Counter, Histogram

CONTENT_TOTAL = Counter(
    "orion_content_total",
    "Content items created, labeled by final status",
    ["status"],
)

GENERATION_DURATION = Histogram(
    "orion_content_generation_duration_seconds",
    "Time taken for the full content generation pipeline",
    ["stage"],
    buckets=[1, 5, 10, 30, 60, 120, 300],
)

CONFIDENCE_SCORE = Histogram(
    "orion_content_confidence_score",
    "Distribution of critique confidence scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)
