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
from orion_common.milvus_client import OrionMilvusClient

from .agents.critique_agent import CritiqueAgent
from .agents.script_generator import ScriptGenerator
from .agents.visual_prompter import VisualPrompter
from .graph.builder import build_content_graph
from .memory.embeddings import get_embedding_provider
from .memory.vector_store import VectorMemory
from .providers.factory import get_llm_provider
from .routes.content import router as content_router
from .services.pipeline import ContentPipeline
from .services.regeneration import RegenerationService

configure_logging()
logger = structlog.get_logger()
settings = get_settings()

# Module-level singletons initialised during lifespan
_pipeline: ContentPipeline | None = None
_event_bus: EventBus | None = None
_regeneration_service: RegenerationService | None = None
_vector_memory: VectorMemory | None = None


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


async def _handle_content_rejected(payload: dict[str, Any]) -> None:
    """Handle content rejection events by triggering regeneration."""
    from orion_common.db.session import get_session

    if _regeneration_service is None:
        await logger.awarning(
            "regeneration_service_not_ready", event="content_rejected"
        )
        return

    content_id = payload.get("content_id", "")
    feedback = payload.get("feedback", "")
    trend_topic = payload.get("trend_topic", "Unknown")
    niche = payload.get("niche", "technology")

    if not content_id or not feedback:
        await logger.awarning(
            "content_rejected_missing_fields",
            content_id=content_id,
            has_feedback=bool(feedback),
        )
        return

    await logger.ainfo(
        "content_rejected_event",
        content_id=content_id,
        feedback_preview=feedback[:100],
    )

    try:
        async for session in get_session():
            await _regeneration_service.regenerate(
                session,
                content_id=content_id,
                feedback=feedback,
                trend_topic=trend_topic,
                niche=niche,
            )
    except Exception:
        await logger.aexception(
            "content_regeneration_failed",
            content_id=content_id,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline, _event_bus, _regeneration_service, _vector_memory  # noqa: PLW0603

    logger.info("service_starting", service="director")

    # Initialise LLM provider
    llm_provider = get_llm_provider(settings)

    # Initialise vector memory (Milvus + embeddings)
    milvus_client = OrionMilvusClient()
    embedding_provider = get_embedding_provider()
    _vector_memory = VectorMemory(milvus_client, embedding_provider)
    try:
        await _vector_memory.initialise()
    except Exception:
        logger.exception("vector_memory_init_failed")
        # Continue without vector memory — degraded but functional
        _vector_memory = None

    # Initialise event bus
    _event_bus = EventBus(settings.redis_url)

    # Initialise script generator with vector memory
    script_gen = ScriptGenerator(llm_provider, vector_memory=_vector_memory)
    visual_prompter = VisualPrompter(llm_provider)

    # Initialise content pipeline
    _graph = build_content_graph(
        script_generator=script_gen,
        critique_agent=CritiqueAgent(llm_provider, script_gen),
        visual_prompter=visual_prompter,
        enable_hitl=False,
    )
    _pipeline = ContentPipeline(_graph, _event_bus, vector_memory=_vector_memory)

    # Initialise regeneration service
    _regeneration_service = RegenerationService(
        script_generator=script_gen,
        visual_prompter=visual_prompter,
        event_bus=_event_bus,
    )

    # Subscribe to events and start listening
    await _event_bus.subscribe(Channels.TREND_DETECTED, _handle_trend_detected)
    await _event_bus.subscribe(Channels.CONTENT_REJECTED, _handle_content_rejected)
    await _event_bus.start_listening()

    logger.info("service_ready", service="director")

    yield

    # Shutdown
    if _vector_memory is not None:
        await _vector_memory.close()
    if _event_bus is not None:
        await _event_bus.close()
    _pipeline = None
    _event_bus = None
    _regeneration_service = None
    _vector_memory = None

    logger.info("service_stopping", service="director")


app = FastAPI(title="Orion Director Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "director", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(content_router)
