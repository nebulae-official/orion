"""Reusable health check, readiness, and metrics endpoints for Orion services."""

from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = structlog.get_logger()


class HealthResponse(BaseModel):
    """Response model for the /health endpoint."""

    status: str  # "ok" | "degraded" | "unhealthy"
    service: str
    version: str = "0.1.0"
    checks: dict[str, Any] = {}


class ReadyResponse(BaseModel):
    """Response model for the /ready endpoint."""

    status: str  # "ready" | "not_ready"
    service: str
    checks: dict[str, bool] = {}


async def check_redis(redis_url: str) -> bool:
    """Check Redis connectivity by issuing a PING command."""
    try:
        r = aioredis.from_url(redis_url)
        await r.ping()
        await r.aclose()
        return True
    except Exception as e:
        logger.warning("redis_health_check_failed", error=str(e))
        return False


async def check_postgres(engine: AsyncEngine) -> bool:
    """Check PostgreSQL connectivity by executing a simple query."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.warning("postgres_health_check_failed", error=str(e))
        return False


def create_health_router(
    service_name: str,
    redis_url: str | None = None,
    db_engine: AsyncEngine | None = None,
) -> APIRouter:
    """Create a health check router with configurable dependency checks.

    Parameters
    ----------
    service_name:
        Identifier for the service (e.g. "scout", "director").
    redis_url:
        If provided, readiness checks will verify Redis connectivity.
    db_engine:
        If provided, readiness checks will verify PostgreSQL connectivity.
    """
    router = APIRouter(tags=["health"])

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", service=service_name)

    @router.get("/ready", response_model=ReadyResponse)
    async def ready() -> ReadyResponse:
        checks: dict[str, bool] = {}
        if redis_url:
            checks["redis"] = await check_redis(redis_url)
        if db_engine:
            checks["postgres"] = await check_postgres(db_engine)

        all_ok = all(checks.values()) if checks else True
        return ReadyResponse(
            status="ready" if all_ok else "not_ready",
            service=service_name,
            checks=checks,
        )

    @router.get("/metrics")
    async def metrics() -> dict[str, Any]:
        # Placeholder for Prometheus metrics.
        # In production, use prometheus_client to expose metrics.
        return {"service": service_name, "metrics": {}}

    return router
