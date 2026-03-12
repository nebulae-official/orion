"""Orion Editor Service -- assembles final videos with TTS, captions, and subtitles."""

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

from .captions.whisper_stt import WhisperCaptioner
from .providers.factory import get_tts_provider
from .routes.render import router as render_router, set_render_pipeline, set_components
from .services.render_pipeline import RenderPipeline
from .video.stitcher import VideoStitcher
from .video.subtitles import SubtitleBurner
from .video.thumbnails import ThumbnailGenerator
from .video.validator import VideoValidator

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="editor")

    # Initialise components
    tts_provider = get_tts_provider(settings)
    captioner = WhisperCaptioner()
    stitcher = VideoStitcher()
    subtitle_burner = SubtitleBurner()
    thumbnail_generator = ThumbnailGenerator()
    video_validator = VideoValidator()

    # Event bus
    event_bus = EventBus(settings.redis_url)

    # Render pipeline
    pipeline = RenderPipeline(
        tts_provider=tts_provider,
        captioner=captioner,
        stitcher=stitcher,
        subtitle_burner=subtitle_burner,
        event_bus=event_bus,
        thumbnail_generator=thumbnail_generator,
        video_validator=video_validator,
    )

    # Wire into route handlers
    set_render_pipeline(pipeline)
    set_components(tts_provider, captioner)

    # Subscribe to MEDIA_GENERATED to auto-trigger renders
    async def on_media_generated(payload: dict[str, Any]) -> None:
        """Auto-trigger the render pipeline when media assets are ready."""
        from uuid import UUID

        from orion_common.db.session import get_session

        content_id_str = payload.get("content_id")
        if not content_id_str:
            await logger.awarning(
                "media_generated_missing_content_id", payload=payload
            )
            return

        content_id = UUID(content_id_str)
        await logger.ainfo("auto_render_triggered", content_id=content_id_str)

        async for session in get_session():
            try:
                await pipeline.render(content_id=content_id, session=session)
            except Exception:
                await logger.aexception(
                    "auto_render_failed", content_id=content_id_str
                )

    await event_bus.subscribe(Channels.MEDIA_GENERATED, on_media_generated)
    await event_bus.start_listening()

    yield

    await event_bus.close()
    logger.info("service_stopping", service="editor")


app = FastAPI(title="Orion Editor Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "editor", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(render_router)
