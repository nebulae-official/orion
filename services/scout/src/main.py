"""Orion Scout Service — trend detection and ingestion."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.event_bus import EventBus
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

from src.filters.deduplication import TrendDeduplicator
from src.filters.niche_filter import DEFAULT_NICHE_CONFIGS, NicheFilter
from src.providers.google_trends import GoogleTrendsProvider
from src.providers.rss import RSSProvider
from src.providers.twitter import TwitterProvider
from src.routes.trends import configure_routes, router as trends_router
from src.scheduler import TrendScheduler

configure_logging()
logger = structlog.get_logger()
settings = get_settings()

# Default active niche (configurable via env in a future iteration)
ACTIVE_NICHE = "tech"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="scout")

    # Providers
    twitter_provider = TwitterProvider()
    providers = [
        GoogleTrendsProvider(),
        RSSProvider(),
        twitter_provider,
    ]

    # Event bus
    event_bus = EventBus(settings.redis_url)
    await event_bus.start_listening()

    # Wire routes
    configure_routes(
        providers=providers,
        event_bus=event_bus,
        active_niche=ACTIVE_NICHE,
    )

    # Deduplicator (applied before niche filter in the pipeline)
    deduplicator = TrendDeduplicator()

    # Niche filter + config
    niche_filter = NicheFilter()
    niche_config = DEFAULT_NICHE_CONFIGS.get(ACTIVE_NICHE, DEFAULT_NICHE_CONFIGS["tech"])

    # Scheduler
    scheduler = TrendScheduler(
        providers=providers,
        niche_filter=niche_filter,
        niche_config=niche_config,
        event_bus=event_bus,
        deduplicator=deduplicator,
    )
    await scheduler.start()

    yield

    # Shutdown
    await scheduler.shutdown()
    await event_bus.close()
    logger.info("service_stopping", service="scout")


app = FastAPI(title="Orion Scout Service", lifespan=lifespan)

health_router = create_health_router("scout", redis_url=settings.redis_url)
app.include_router(health_router)
app.include_router(trends_router)
