"""Tests for Pulse metrics and event aggregator logic."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from src.schemas import (
    CostCategory,
    ErrorTrend,
    FunnelMetrics,
    PipelineMetrics,
    PipelineStage,
    ProviderUsage,
    StageMetric,
    TrendAnalytics,
    TrendSourceCount,
)
from src.services.event_aggregator import (
    _ALL_CHANNELS,
    _CHANNEL_SERVICE_MAP,
    EventAggregator,
)


class TestPulseSchemas:
    """Tests for Pulse Pydantic models."""

    def test_pipeline_metrics_defaults(self) -> None:
        metrics = PipelineMetrics()
        assert metrics.throughput_per_hour == 0.0
        assert metrics.error_rate == 0.0
        assert metrics.stages == []

    def test_stage_metric(self) -> None:
        sm = StageMetric(stage="render", total_runs=10, completed=8, failed=2)
        assert sm.avg_latency_seconds == 0.0
        assert sm.failed == 2

    def test_funnel_metrics_defaults(self) -> None:
        fm = FunnelMetrics()
        assert fm.generated == 0
        assert fm.published == 0

    def test_cost_category_enum(self) -> None:
        assert CostCategory.llm_tokens == "llm_tokens"
        assert CostCategory.image_generation == "image_generation"
        assert CostCategory.tts_characters == "tts_characters"
        assert CostCategory.video_clips == "video_clips"

    def test_pipeline_stage_enum(self) -> None:
        assert PipelineStage.research == "research"
        assert PipelineStage.render == "render"

    def test_trend_analytics_model(self) -> None:
        ta = TrendAnalytics(
            total_found=100,
            total_used=25,
            total_discarded=75,
            conversion_rate=0.25,
            by_source=[TrendSourceCount(source="rss", count=50)],
        )
        assert ta.conversion_rate == 0.25
        assert len(ta.by_source) == 1

    def test_error_trend_model(self) -> None:
        et = ErrorTrend(
            timestamp="2024-01-01T00:00:00Z",
            error_count=5,
            total_count=100,
            error_rate=0.05,
        )
        assert et.error_rate == 0.05

    def test_provider_usage_model(self) -> None:
        pu = ProviderUsage(
            provider="comfyui",
            request_count=100,
            total_cost=5.50,
            error_count=2,
        )
        assert pu.provider == "comfyui"


class TestEventAggregator:
    """Tests for the EventAggregator service."""

    def test_all_channels_defined(self) -> None:
        """All expected channels are in the subscription list."""
        assert len(_ALL_CHANNELS) >= 5
        assert all(isinstance(ch, str) for ch in _ALL_CHANNELS)

    def test_channel_service_map_complete(self) -> None:
        """Every subscribed channel has a service mapping."""
        for channel in _ALL_CHANNELS:
            assert channel in _CHANNEL_SERVICE_MAP

    @pytest.mark.asyncio
    async def test_start_subscribes_to_channels(self) -> None:
        """start() subscribes to all defined channels."""
        event_bus = AsyncMock()
        session_factory = MagicMock()
        aggregator = EventAggregator(event_bus, session_factory)

        await aggregator.start()

        assert event_bus.subscribe.call_count == len(_ALL_CHANNELS)
        event_bus.start_listening.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_event_persists(self) -> None:
        """_handle_event creates an analytics event record."""
        event_bus = AsyncMock()
        session = AsyncMock()
        session_factory = MagicMock()
        session_factory.return_value.__aenter__ = AsyncMock(return_value=session)
        session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        aggregator = EventAggregator(event_bus, session_factory)

        with patch(
            "src.services.event_aggregator.EventRepository"
        ) as MockRepo:
            repo = AsyncMock()
            MockRepo.return_value = repo

            await aggregator._handle_event(
                {"_channel": "orion.trend_detected", "topic": "AI News", "source": "rss"}
            )

            repo.create.assert_called_once()
