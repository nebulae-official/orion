"""Cost tracker for provider usage.

Subscribes to cost-related events from Redis and records them.
Tracks LLM token costs, image generation costs, TTS character usage,
and video clip costs.
"""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from orion_common.event_bus import EventBus
from orion_common.events import Channels

from services.pulse.src.repositories.cost_repo import CostRepository
from services.pulse.src.schemas import CostCategory

logger = structlog.get_logger(__name__)

# Default cost rates per unit (configurable via settings in production)
_COST_RATES: dict[str, float] = {
    CostCategory.llm_tokens: 0.00003,        # per token
    CostCategory.image_generation: 0.02,      # per image
    CostCategory.tts_characters: 0.000015,    # per character
    CostCategory.video_clips: 0.05,           # per clip
}

# Channels that carry cost-relevant events
_COST_CHANNELS: list[str] = [
    Channels.CONTENT_CREATED,
    Channels.CONTENT_UPDATED,
    Channels.MEDIA_GENERATED,
    Channels.PIPELINE_STAGE_CHANGED,
]


class CostTracker:
    """Subscribes to cost-related events and records provider costs."""

    def __init__(
        self,
        event_bus: EventBus,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._event_bus = event_bus
        self._session_factory = session_factory

    async def start(self) -> None:
        """Subscribe to cost-related channels."""
        for channel in _COST_CHANNELS:
            await self._event_bus.subscribe(channel, self._handle_cost_event)
        await logger.ainfo("cost_tracker_started", channels=len(_COST_CHANNELS))

    async def _handle_cost_event(self, data: dict[str, Any]) -> None:
        """Extract cost information from events and record it."""
        channel = data.get("_channel", "unknown")
        provider = data.get("provider", "unknown")
        cost_data = data.get("cost", {})

        if not cost_data:
            return

        category = self._infer_category(channel, cost_data)
        units = float(cost_data.get("units", 0))
        rate = cost_data.get("rate", _COST_RATES.get(category, 0))
        amount = units * rate

        if amount <= 0:
            return

        async with self._session_factory() as session:
            repo = CostRepository(session)
            await repo.create(
                provider=provider,
                category=category,
                amount=amount,
                units=units,
                metadata={
                    "channel": channel,
                    "rate": rate,
                    **{k: v for k, v in cost_data.items() if k not in ("units", "rate")},
                },
            )

    @staticmethod
    def _infer_category(channel: str, cost_data: dict[str, Any]) -> str:
        """Determine cost category from the event channel and payload."""
        explicit = cost_data.get("category")
        if explicit and explicit in {c.value for c in CostCategory}:
            return explicit

        if channel == Channels.MEDIA_GENERATED:
            media_type = cost_data.get("media_type", "image")
            if media_type == "video":
                return CostCategory.video_clips
            if media_type == "audio":
                return CostCategory.tts_characters
            return CostCategory.image_generation

        return CostCategory.llm_tokens
