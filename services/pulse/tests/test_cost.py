"""Tests for cost tracking logic."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from orion_common.events import Channels
from src.schemas import (
    CostCategory,
    CostProjection,
    CostSummary,
    DailyCostSummary,
    ProviderCostSummary,
)
from src.services.cost_tracker import _COST_CHANNELS, _COST_RATES, CostTracker


class TestCostTracker:
    """Tests for the CostTracker service."""

    @pytest.mark.asyncio
    async def test_start_subscribes_to_channels(self) -> None:
        """start() subscribes to all cost-related channels."""
        event_bus = AsyncMock()
        session_factory = MagicMock()
        tracker = CostTracker(event_bus, session_factory)

        await tracker.start()

        assert event_bus.subscribe.call_count == len(_COST_CHANNELS)

    @pytest.mark.asyncio
    async def test_handle_cost_event_records_cost(self) -> None:
        """_handle_cost_event creates a cost record when cost data exists."""
        event_bus = AsyncMock()
        session = AsyncMock()
        session_factory = MagicMock()
        session_factory.return_value.__aenter__ = AsyncMock(return_value=session)
        session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        tracker = CostTracker(event_bus, session_factory)

        with patch("src.services.cost_tracker.CostRepository") as mock_repo:
            repo = AsyncMock()
            mock_repo.return_value = repo

            await tracker._handle_cost_event(
                {
                    "_channel": Channels.MEDIA_GENERATED,
                    "provider": "fal_ai",
                    "cost": {"units": 5, "media_type": "image"},
                }
            )

            repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_cost_event_skips_no_cost(self) -> None:
        """_handle_cost_event does nothing when no cost data exists."""
        event_bus = AsyncMock()
        session_factory = MagicMock()
        tracker = CostTracker(event_bus, session_factory)

        # No cost field → should not attempt to persist
        await tracker._handle_cost_event(
            {
                "_channel": "orion.content_created",
                "provider": "test",
            }
        )
        # No exception, no session creation

    @pytest.mark.asyncio
    async def test_handle_cost_event_skips_zero_amount(self) -> None:
        """_handle_cost_event skips when calculated amount is zero."""
        event_bus = AsyncMock()
        session_factory = MagicMock()
        tracker = CostTracker(event_bus, session_factory)

        await tracker._handle_cost_event(
            {
                "_channel": "orion.content_created",
                "provider": "test",
                "cost": {"units": 0},
            }
        )

    def test_infer_category_explicit(self) -> None:
        """_infer_category uses explicit category when provided."""
        result = CostTracker._infer_category(
            "orion.content_created",
            {"category": "image_generation"},
        )
        assert result == CostCategory.image_generation

    def test_infer_category_media_image(self) -> None:
        """_infer_category infers image_generation for media events."""
        result = CostTracker._infer_category(
            Channels.MEDIA_GENERATED,
            {"media_type": "image"},
        )
        assert result == CostCategory.image_generation

    def test_infer_category_media_video(self) -> None:
        """_infer_category infers video_clips for video media events."""
        result = CostTracker._infer_category(
            Channels.MEDIA_GENERATED,
            {"media_type": "video"},
        )
        assert result == CostCategory.video_clips

    def test_infer_category_media_audio(self) -> None:
        """_infer_category infers tts_characters for audio media events."""
        result = CostTracker._infer_category(
            Channels.MEDIA_GENERATED,
            {"media_type": "audio"},
        )
        assert result == CostCategory.tts_characters

    def test_infer_category_default_llm(self) -> None:
        """_infer_category defaults to llm_tokens."""
        result = CostTracker._infer_category("orion.content_created", {})
        assert result == CostCategory.llm_tokens


class TestCostSchemas:
    """Tests for cost-related Pydantic models."""

    def test_cost_summary_defaults(self) -> None:
        cs = CostSummary()
        assert cs.total_cost == 0.0
        assert cs.by_category == {}
        assert cs.record_count == 0

    def test_daily_cost_summary(self) -> None:
        dcs = DailyCostSummary(
            date="2024-01-15",
            total_cost=12.50,
            by_category={"llm_tokens": 10.0, "image_generation": 2.50},
        )
        assert dcs.date == "2024-01-15"
        assert dcs.total_cost == 12.50

    def test_provider_cost_summary(self) -> None:
        pcs = ProviderCostSummary(
            provider="fal_ai",
            total_cost=25.0,
            by_category={"image_generation": 25.0},
        )
        assert pcs.provider == "fal_ai"

    def test_cost_projection(self) -> None:
        cp = CostProjection(
            period="monthly",
            current_cost=100.0,
            projected_cost=150.0,
            trend="increasing",
        )
        assert cp.trend == "increasing"

    def test_cost_rates_defined(self) -> None:
        """Default cost rates are defined for all categories."""
        for category in CostCategory:
            assert category.value in _COST_RATES
