"""Orion Director Service — orchestrates the content creation pipeline."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.event_bus import EventBus
from orion_common.events import Channels
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

from .providers.factory import get_llm_provider
from .routes.content import router as content_router
from .services.pipeline import ContentPipeline

configure_logging()
logger = structlog.get_logger()
settings = get_settings()

# Module-level singletons initialised during lifespan
_pipeline: ContentPipeline | None = None
_event_bus: EventBus | None = None


async def _handle_trend_detected(payload: dict[str, Any]) -> None:
    """Auto-trigger the content pipeline when a trend is detected."""
    from orion_common.db.session import get_session

    if _pipeline is None:
        await logger.awarning("pipeline_not_ready", event="trend_detected")
        return

    trend_id = payload.get("trend_id")
    trend_topic = payload.get("topic", payload.get("trend_topic", "Unknown"))

    await logger.ainfo(
        "trend_detected_event",
        trend_id=trend_id,
        trend_topic=trend_topic,
    )

    try:
        async for session in get_session():
            await _pipeline.run(
                session,
                trend_id=trend_id,
                trend_topic=trend_topic,
                niche=payload.get("niche", "technology"),
            )
    except Exception:
        await logger.aexception(
            "trend_pipeline_failed",
            trend_id=trend_id,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline, _event_bus  # noqa: PLW0603

    logger.info("service_starting", service="director")

    # Initialise LLM provider
    llm_provider = get_llm_provider(settings)

    # Initialise event bus
    _event_bus = EventBus(settings.redis_url)

    # Initialise content pipeline
    _pipeline = ContentPipeline(llm_provider, _event_bus)

    # Subscribe to trend events and start listening
    await _event_bus.subscribe(Channels.TREND_DETECTED, _handle_trend_detected)
    await _event_bus.start_listening()

    logger.info("service_ready", service="director")

    yield

    # Shutdown
    if _event_bus is not None:
        await _event_bus.close()
    _pipeline = None
    _event_bus = None

    logger.info("service_stopping", service="director")


app = FastAPI(title="Orion Director Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "director", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(content_router)
