from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router
from orion_common.logging import configure_logging

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="pulse")
    yield
    logger.info("service_stopping", service="pulse")


app = FastAPI(title="Orion Pulse Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "pulse", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
