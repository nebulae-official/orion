"""Async Redis client utilities for Orion services."""

from __future__ import annotations

import redis.asyncio as redis

from orion_common.config import get_settings


async def get_redis() -> redis.Redis:
    """Create and return an async Redis client from global settings.

    The caller is responsible for closing the connection when done.
    """
    settings = get_settings()
    return redis.from_url(settings.redis_url, decode_responses=True)
