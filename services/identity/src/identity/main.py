"""Orion Identity Service — user management and authentication."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router
from orion_common.logging import configure_logging
from orion_common.middleware import InternalAuthMiddleware

from .routes.auth import router as auth_router
from .routes.users import router as users_router

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="identity")
    yield
    logger.info("service_stopping", service="identity")


app = FastAPI(title="Orion Identity Service", lifespan=lifespan)
app.add_middleware(InternalAuthMiddleware, token=settings.internal_token)

engine = get_engine()
health_router = create_health_router("identity", redis_url=settings.redis_url, db_engine=engine)
app.include_router(health_router)
app.include_router(auth_router, prefix="/internal")
app.include_router(users_router)
