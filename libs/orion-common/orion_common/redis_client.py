"""Async Redis client utilities for Orion services."""

from __future__ import annotations

import redis.asyncio as redis

from orion_common.config import get_settings

_clients: dict[str, redis.Redis] = {}


def get_redis(url: str | None = None) -> redis.Redis:
    """Return a cached async Redis client for the given URL.

    If *url* is ``None`` the URL is read from ``CommonSettings.redis_url``.
    The same client instance is returned for identical URLs so that TCP
    connections are reused across the application.

    The caller should **not** close the returned client — it is shared.
    """
    if url is None:
        url = get_settings().redis_url

    if url not in _clients:
        _clients[url] = redis.from_url(url, decode_responses=True)

    return _clients[url]


async def close_redis() -> None:
    """Close all cached Redis clients. Call during application shutdown."""
    for client in _clients.values():
        await client.aclose()
    _clients.clear()
