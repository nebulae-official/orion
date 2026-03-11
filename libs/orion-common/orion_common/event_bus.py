"""Async Redis pub/sub event bus for inter-service communication."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Awaitable, Callable

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]


class EventBus:
    """Lightweight async wrapper around Redis pub/sub.

    Usage::

        bus = EventBus("redis://localhost:6379")
        await bus.subscribe(Channels.TREND_DETECTED, my_handler)
        await bus.start_listening()  # runs in background
        await bus.publish(Channels.TREND_DETECTED, {"trend_id": "abc"})
    """

    def __init__(self, redis_url: str) -> None:
        self._redis: redis.Redis = redis.from_url(redis_url, decode_responses=True)
        self._pubsub: redis.client.PubSub = self._redis.pubsub()
        self._handlers: dict[str, list[EventHandler]] = {}
        self._listener_task: asyncio.Task[None] | None = None

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        """Publish a JSON-encoded event to *channel*."""
        message = json.dumps(payload)
        await self._redis.publish(channel, message)
        await logger.adebug(
            "event_published", channel=channel, payload=payload
        )

    async def subscribe(self, channel: str, handler: EventHandler) -> None:
        """Register *handler* for events on *channel*.

        Multiple handlers per channel are supported.
        """
        if channel not in self._handlers:
            self._handlers[channel] = []
            await self._pubsub.subscribe(channel)
        self._handlers[channel].append(handler)
        await logger.adebug("handler_subscribed", channel=channel)

    async def start_listening(self) -> None:
        """Start consuming pub/sub messages in a background task."""
        if self._listener_task is not None:
            return
        self._listener_task = asyncio.create_task(self._listen())
        await logger.ainfo("event_bus_listening")

    async def _listen(self) -> None:
        """Internal loop — dispatches messages to registered handlers."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue
                channel: str = message["channel"]
                try:
                    data: dict[str, Any] = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    await logger.awarning(
                        "invalid_event_payload",
                        channel=channel,
                        raw=message["data"],
                    )
                    continue

                for handler in self._handlers.get(channel, []):
                    try:
                        await handler(data)
                    except Exception:
                        await logger.aexception(
                            "handler_error",
                            channel=channel,
                            handler=handler.__name__,
                        )
        except asyncio.CancelledError:
            pass

    async def close(self) -> None:
        """Unsubscribe, cancel the listener task, and close connections."""
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None
        await self._pubsub.unsubscribe()
        await self._pubsub.aclose()
        await self._redis.aclose()
        await logger.ainfo("event_bus_closed")
