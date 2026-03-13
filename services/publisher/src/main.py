"""Publisher service entry point."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router, instrument_app
from orion_common.logging import configure_logging

from src.routes import accounts, publish
from src.services.crypto import validate_encryption_key

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="publisher")
    validate_encryption_key()
    logger.info("encryption_key_validated", service="publisher")
    yield
    logger.info("service_stopping", service="publisher")


app = FastAPI(title="Orion Publisher Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "publisher", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(accounts.router)
app.include_router(publish.router)
instrument_app(app, service_name="publisher")
