"""Tests for the RedisCache class."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from orion_common.cache import RedisCache


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Return a mock async Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock()
    redis.delete = AsyncMock()
    return redis


@pytest.fixture
def cache(mock_redis: AsyncMock) -> RedisCache:
    """Return a RedisCache backed by the mock Redis."""
    return RedisCache(mock_redis)


@pytest.mark.asyncio
async def test_get_returns_none_on_miss(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """get() returns None when the key does not exist."""
    mock_redis.get.return_value = None
    result = await cache.get("missing-key")
    assert result is None
    mock_redis.get.assert_awaited_once_with("missing-key")


@pytest.mark.asyncio
async def test_get_returns_cached_value(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """get() returns the stored string on a cache hit."""
    mock_redis.get.return_value = '{"items": []}'
    result = await cache.get("my-key")
    assert result == '{"items": []}'


@pytest.mark.asyncio
async def test_set_stores_value_with_ttl(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """set() stores a value with the specified TTL."""
    await cache.set("key1", "value1", ttl=120)
    mock_redis.set.assert_awaited_once_with("key1", "value1", ex=120)


@pytest.mark.asyncio
async def test_set_default_ttl(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """set() uses 60s TTL by default."""
    await cache.set("key1", "value1")
    mock_redis.set.assert_awaited_once_with("key1", "value1", ex=60)


@pytest.mark.asyncio
async def test_delete_removes_key(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """delete() removes the key from Redis."""
    await cache.delete("key1")
    mock_redis.delete.assert_awaited_once_with("key1")


@pytest.mark.asyncio
async def test_get_or_set_cache_hit(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """get_or_set() returns cached value without calling factory."""
    mock_redis.get.return_value = "cached"
    factory = AsyncMock(return_value="fresh")

    result = await cache.get_or_set("key", factory, ttl=30)

    assert result == "cached"
    factory.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_or_set_cache_miss(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """get_or_set() calls factory and caches result on miss."""
    mock_redis.get.return_value = None
    factory = AsyncMock(return_value="fresh")

    result = await cache.get_or_set("key", factory, ttl=30)

    assert result == "fresh"
    factory.assert_awaited_once()
    mock_redis.set.assert_awaited_once_with("key", "fresh", ex=30)


@pytest.mark.asyncio
async def test_get_handles_redis_error(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """get() returns None and does not raise when Redis fails."""
    mock_redis.get.side_effect = ConnectionError("Redis down")
    result = await cache.get("key")
    assert result is None


@pytest.mark.asyncio
async def test_set_handles_redis_error(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """set() silently logs and does not raise when Redis fails."""
    mock_redis.set.side_effect = ConnectionError("Redis down")
    # Should not raise
    await cache.set("key", "value")


@pytest.mark.asyncio
async def test_delete_handles_redis_error(cache: RedisCache, mock_redis: AsyncMock) -> None:
    """delete() silently logs and does not raise when Redis fails."""
    mock_redis.delete.side_effect = ConnectionError("Redis down")
    # Should not raise
    await cache.delete("key")
