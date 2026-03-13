"""Redis cache-aside layer for Orion services."""

from __future__ import annotations

from typing import Awaitable, Callable, Optional

import structlog
from redis.asyncio import Redis

from orion_common.redis_client import get_redis

logger = structlog.get_logger(__name__)


class RedisCache:
    """Async Redis cache with get/set/delete and cache-aside (get_or_set)."""

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def get(self, key: str) -> Optional[str]:
        """Get a value from cache by key. Returns None on miss."""
        try:
            return await self._redis.get(key)
        except Exception:
            logger.warning("cache_get_error", key=key, exc_info=True)
            return None

    async def set(self, key: str, value: str, ttl: int = 60) -> None:
        """Set a value in cache with a TTL in seconds."""
        try:
            await self._redis.set(key, value, ex=ttl)
        except Exception:
            logger.warning("cache_set_error", key=key, exc_info=True)

    async def delete(self, key: str) -> None:
        """Delete a key from cache."""
        try:
            await self._redis.delete(key)
        except Exception:
            logger.warning("cache_delete_error", key=key, exc_info=True)

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Awaitable[str]],
        ttl: int = 60,
    ) -> str:
        """Return cached value or call factory, cache the result, and return it."""
        cached = await self.get(key)
        if cached is not None:
            return cached
        value = await factory()
        await self.set(key, value, ttl=ttl)
        return value


async def get_cache() -> RedisCache:
    """Create and return a RedisCache backed by the global Redis connection."""
    redis = await get_redis()
    return RedisCache(redis)
