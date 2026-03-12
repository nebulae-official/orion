from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from orion_common.config import get_settings
from orion_common.db.session import get_engine, get_session
from orion_common.event_bus import EventBus
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

from services.pulse.src.routes import analytics, costs, pipeline
from services.pulse.src.services.cost_tracker import CostTracker
from services.pulse.src.services.event_aggregator import EventAggregator

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="pulse")

    # Create the event bus
    event_bus = EventBus(settings.redis_url)

    # Session factory for background tasks
    engine = get_engine()
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    # Start EventAggregator
    aggregator = EventAggregator(event_bus, session_factory)
    analytics.set_aggregator(aggregator)
    await aggregator.start()

    # Start CostTracker
    cost_tracker = CostTracker(event_bus, session_factory)
    await cost_tracker.start()

    logger.info("service_ready", service="pulse")
    yield

    # Shutdown
    await event_bus.close()
    logger.info("service_stopping", service="pulse")


app = FastAPI(title="Orion Pulse Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "pulse", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(analytics.router)
app.include_router(costs.router)
app.include_router(pipeline.router)
