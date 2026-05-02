"""Orion Provider Service — centralized AI gateway for LLM and media providers."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from orion_common.config import get_settings
from orion_common.health import create_health_router
from orion_common.identity_client import IdentityClient
from orion_common.logging import configure_logging
from orion_common.middleware import InternalAuthMiddleware

from src.key_resolver import KeyResolver
from src.routes.catalog import router as catalog_router
from src.routes.image import router as image_router
from src.routes.llm import router as llm_router
from src.routes.tts import router as tts_router

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    identity_client = IdentityClient(
        base_url=settings.identity_url,
        internal_token=settings.internal_token,
    )
    # Provider is resolved per-request from the catalog — no hardcoded name here.
    app.state.key_resolver = KeyResolver(identity_client=identity_client)
    logger.info("service_starting", service="provider")
    yield
    logger.info("service_stopping", service="provider")


app = FastAPI(title="Orion Provider Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(InternalAuthMiddleware, token=settings.internal_token)

health_router = create_health_router("provider")
app.include_router(health_router)
app.include_router(catalog_router)
app.include_router(llm_router)
app.include_router(image_router)
app.include_router(tts_router)
