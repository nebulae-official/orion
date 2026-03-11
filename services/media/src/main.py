"""Orion Media Service — image generation with ComfyUI and Fal.ai."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.db.models import AssetType
from orion_common.db.session import get_session
from orion_common.event_bus import EventBus
from orion_common.events import Channels
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

from .providers.base import ImageRequest
from .providers.factory import get_image_provider
from .repositories.asset_repo import MediaAssetRepository
from .routes.images import configure_router, router as images_router
from .services.batch_generator import BatchGenerator, BatchImageRequest

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


async def _handle_content_created(data: dict[str, Any]) -> None:
    """Auto-generate images when a CONTENT_CREATED event arrives.

    Expects the payload to contain ``content_id`` and ``visual_prompts``
    (a list of prompt strings).
    """
    content_id_str = data.get("content_id")
    visual_prompts = data.get("visual_prompts")

    if not content_id_str or not visual_prompts:
        logger.info("content_created_skipped", reason="missing fields", data=data)
        return

    content_id = uuid.UUID(content_id_str)
    logger.info(
        "auto_generating_images",
        content_id=content_id_str,
        prompt_count=len(visual_prompts),
    )

    provider = get_image_provider(settings)
    batch_gen = BatchGenerator(provider, max_concurrent=3)

    prompts = [ImageRequest(prompt=p) for p in visual_prompts]
    batch_request = BatchImageRequest(content_id=content_id, prompts=prompts)
    batch_result = await batch_gen.generate_batch(batch_request)

    # Persist results
    async for session in get_session():
        repo = MediaAssetRepository(session)
        for r in batch_result.results:
            await repo.create(
                content_id=content_id,
                asset_type=AssetType.image,
                provider=r.provider,
                file_path=r.file_path,
                metadata=r.metadata,
            )

    # Publish outcome event
    event_bus: EventBus = app.state.event_bus
    if batch_result.results:
        await event_bus.publish(
            Channels.MEDIA_GENERATED,
            {
                "content_id": content_id_str,
                "asset_count": len(batch_result.results),
                "providers": list({r.provider for r in batch_result.results}),
            },
        )
    if batch_result.failed:
        await event_bus.publish(
            Channels.MEDIA_FAILED,
            {
                "content_id": content_id_str,
                "errors": batch_result.failed,
            },
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialise providers, event bus, and router."""
    logger.info("service_starting", service="media")

    # Build provider chain and batch generator
    provider = get_image_provider(settings)
    batch_gen = BatchGenerator(provider, max_concurrent=3)
    configure_router(provider, batch_gen)

    # Start event bus
    event_bus = EventBus(settings.redis_url)
    app.state.event_bus = event_bus
    await event_bus.subscribe(Channels.CONTENT_CREATED, _handle_content_created)
    await event_bus.start_listening()

    yield

    await event_bus.close()
    logger.info("service_stopping", service="media")


app = FastAPI(title="Orion Media Service", lifespan=lifespan)

health_router = create_health_router("media", redis_url=settings.redis_url)
app.include_router(health_router)
app.include_router(images_router)
