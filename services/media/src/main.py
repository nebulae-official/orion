from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="media")
    yield
    logger.info("service_stopping", service="media")


app = FastAPI(title="Orion Media Service", lifespan=lifespan)

health_router = create_health_router("media", redis_url=settings.redis_url)
app.include_router(health_router)
