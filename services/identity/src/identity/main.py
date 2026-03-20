"""Orion Identity Service — user management and authentication."""

import asyncio
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI
from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router
from orion_common.logging import configure_logging
from orion_common.middleware import InternalAuthMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .routes.auth import router as auth_router
from .routes.notifications import router as notifications_router
from .routes.users import router as users_router
from .services.cleanup import prune_expired_tokens
from .services.notification_consumer import notification_consumer

configure_logging()
logger = structlog.get_logger()
settings = get_settings()

engine = get_engine()
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine, expire_on_commit=False
)

redis_client: aioredis.Redis = aioredis.from_url(
    settings.redis_url, decode_responses=True
)


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
    consumer_task = asyncio.create_task(
        notification_consumer(redis_client, session_factory)
    )
    yield
    consumer_task.cancel()
    cleanup_task.cancel()
    logger.info("service_stopping", service="identity")


app = FastAPI(title="Orion Identity Service", lifespan=lifespan)
app.add_middleware(InternalAuthMiddleware, token=settings.internal_token)

health_router = create_health_router("identity", redis_url=settings.redis_url, db_engine=engine)
app.include_router(health_router)
app.include_router(auth_router, prefix="/internal")
app.include_router(users_router)
app.include_router(notifications_router)
