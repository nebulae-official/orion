"""Pydantic v2 models for analytics events, metrics, and cost tracking."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class PipelineStage(StrEnum):
    """Stages in the content generation pipeline."""

    research = "research"
    script = "script"
    critique = "critique"
    images = "images"
    video = "video"
    render = "render"


class CostCategory(StrEnum):
    """Cost category for provider usage tracking."""

    llm_tokens = "llm_tokens"
    image_generation = "image_generation"
    tts_characters = "tts_characters"
    video_clips = "video_clips"


# ---------------------------------------------------------------------------
# Analytics Events
# ---------------------------------------------------------------------------


class AnalyticsEventCreate(BaseModel):
    """Payload for creating an analytics event."""

    channel: str = Field(..., description="Redis channel the event was received on")
    payload: dict = Field(default_factory=dict, description="Raw event payload")
    service: str = Field(..., description="Originating service name")


class AnalyticsEventResponse(BaseModel):
    """Response model for a stored analytics event."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel: str
    payload: dict
    service: str
    timestamp: datetime


class AnalyticsEventsListResponse(BaseModel):
    """Paginated list of analytics events."""

    items: list[AnalyticsEventResponse]
    total: int
    page: int
    limit: int


# ---------------------------------------------------------------------------
# Pipeline Metrics
# ---------------------------------------------------------------------------


class StageMetric(BaseModel):
    """Throughput and latency for a single pipeline stage."""

    stage: str
    total_runs: int = 0
    completed: int = 0
    failed: int = 0
    avg_latency_seconds: float = 0.0


class PipelineMetrics(BaseModel):
    """Aggregated pipeline metrics across all stages."""

    throughput_per_hour: float = 0.0
    error_rate: float = 0.0
    stages: list[StageMetric] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Cost Tracking
# ---------------------------------------------------------------------------


class CostRecord(BaseModel):
    """A single cost entry for provider usage."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    category: CostCategory
    amount: float
    units: float
    metadata: dict = Field(default_factory=dict)
    recorded_at: datetime


class CostSummary(BaseModel):
    """Summarized costs for a time range."""

    total_cost: float = 0.0
    by_category: dict[str, float] = Field(default_factory=dict)
    record_count: int = 0


class DailyCostSummary(BaseModel):
    """Cost summary for a single day."""

    date: str
    total_cost: float = 0.0
    by_category: dict[str, float] = Field(default_factory=dict)


class ProviderCostSummary(BaseModel):
    """Cost summary grouped by provider."""

    provider: str
    total_cost: float = 0.0
    by_category: dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Pipeline Health / Dashboard
# ---------------------------------------------------------------------------


class FunnelMetrics(BaseModel):
    """Content funnel: generated -> review -> approved -> published."""

    generated: int = 0
    review: int = 0
    approved: int = 0
    published: int = 0
    rejected: int = 0


class ProviderUsage(BaseModel):
    """Usage breakdown for a single provider."""

    provider: str
    request_count: int = 0
    total_cost: float = 0.0
    error_count: int = 0


class ErrorTrend(BaseModel):
    """Error rate data point for a time bucket."""

    timestamp: str
    error_count: int = 0
    total_count: int = 0
    error_rate: float = 0.0


class CostProjection(BaseModel):
    """Cost projection for a time period."""

    period: str  # "daily", "weekly", "monthly"
    current_cost: float = 0.0
    projected_cost: float = 0.0
    trend: str = "stable"  # "increasing", "decreasing", "stable"


# ---------------------------------------------------------------------------
# Trend Analytics
# ---------------------------------------------------------------------------


class TrendSourceCount(BaseModel):
    """Count of trends by source."""

    source: str
    count: int


class TrendAnalytics(BaseModel):
    """Trend discovery analytics."""

    total_found: int = 0
    total_used: int = 0
    total_discarded: int = 0
    conversion_rate: float = 0.0
    by_source: list[TrendSourceCount] = Field(default_factory=list)
