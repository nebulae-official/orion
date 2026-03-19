"""Orion Identity Service — user management and authentication."""

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router
from orion_common.logging import configure_logging
from orion_common.middleware import InternalAuthMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from .routes.auth import router as auth_router
from .routes.users import router as users_router
from .services.cleanup import prune_expired_tokens

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


async def token_cleanup_loop(engine) -> None:
    """Run token cleanup every 24 hours."""
    while True:
        await asyncio.sleep(86400)  # 24 hours
        try:
            async with AsyncSession(engine) as session:
                await prune_expired_tokens(session)
        except Exception:
            logger.exception("token_cleanup_error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="identity")
    cleanup_task = asyncio.create_task(token_cleanup_loop(engine))
    yield
    cleanup_task.cancel()
    logger.info("service_stopping", service="identity")


app = FastAPI(title="Orion Identity Service", lifespan=lifespan)
app.add_middleware(InternalAuthMiddleware, token=settings.internal_token)

engine = get_engine()
health_router = create_health_router("identity", redis_url=settings.redis_url, db_engine=engine)
app.include_router(health_router)
app.include_router(auth_router, prefix="/internal")
app.include_router(users_router)
