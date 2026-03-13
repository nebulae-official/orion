"""Lightweight retry / acknowledgment layer on top of :class:`EventBus`.

This module adds at-least-once delivery semantics by persisting published
events in a Redis list (``orion:events:pending:{channel}``) and removing
them only after the handler succeeds.  Services can call
:meth:`ReliableEventBus.replay_missed` on startup to re-process events
that were published while the service was down.

This is a stepping-stone toward full event sourcing — it intentionally
stays simple and builds on the existing pub/sub infrastructure.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Awaitable, Callable

import redis.asyncio as redis
import structlog

from orion_common.event_bus import EventBus

logger = structlog.get_logger(__name__)

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]

# How long pending events are kept before Redis auto-expires them.
_DEFAULT_EVENT_TTL_SECONDS: int = 86400  # 24 hours


def _pending_key(channel: str) -> str:
    """Return the Redis key for the pending-event list of *channel*."""
    return f"orion:events:pending:{channel}"


class ReliableEventBus:
    """Wraps :class:`EventBus` with a pending-event store for reliability.

    Parameters
    ----------
    redis_url:
        Redis connection URL.
    event_ttl:
        TTL in seconds for pending events.  Defaults to 24 hours.
    """

    def __init__(
        self,
        redis_url: str,
        event_ttl: int = _DEFAULT_EVENT_TTL_SECONDS,
    ) -> None:
        self._inner: EventBus = EventBus(redis_url)
        self._redis: redis.Redis = redis.from_url(redis_url, decode_responses=True)
        self._event_ttl: int = event_ttl
        self._handlers: dict[str, list[EventHandler]] = {}

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def publish(self, channel: str, payload: dict[str, Any]) -> str:
        """Publish an event and persist it in the pending list.

        Returns the unique event id assigned to this event.
        """
        event_id = str(uuid.uuid4())
        envelope: dict[str, Any] = {
            "event_id": event_id,
            "channel": channel,
            "payload": payload,
        }
        key = _pending_key(channel)
        await self._redis.rpush(key, json.dumps(envelope))
        await self._redis.expire(key, self._event_ttl)

        # Delegate to the inner bus for real-time pub/sub delivery.
        await self._inner.publish(channel, {**payload, "_event_id": event_id})
        await logger.adebug(
            "reliable_event_published",
            channel=channel,
            event_id=event_id,
        )
        return event_id

    # ------------------------------------------------------------------
    # Subscribing
    # ------------------------------------------------------------------

    async def subscribe(self, channel: str, handler: EventHandler) -> None:
        """Register a handler that auto-acknowledges on success."""
        if channel not in self._handlers:
            self._handlers[channel] = []
        self._handlers[channel].append(handler)

        async def _ack_wrapper(data: dict[str, Any]) -> None:
            event_id = data.get("_event_id")
            clean_data = {k: v for k, v in data.items() if k != "_event_id"}
            await handler(clean_data)
            # Acknowledge by removing from pending list.
            if event_id is not None:
                await self.acknowledge(channel, event_id)

        await self._inner.subscribe(channel, _ack_wrapper)

    async def acknowledge(self, channel: str, event_id: str) -> None:
        """Remove a successfully processed event from the pending list."""
        key = _pending_key(channel)
        # Scan the list and remove the matching envelope.
        raw_items: list[str] = await self._redis.lrange(key, 0, -1)
        for item in raw_items:
            try:
                envelope = json.loads(item)
            except (json.JSONDecodeError, TypeError):
                continue
            if envelope.get("event_id") == event_id:
                await self._redis.lrem(key, 1, item)
                await logger.adebug(
                    "event_acknowledged",
                    channel=channel,
                    event_id=event_id,
                )
                return

    # ------------------------------------------------------------------
    # Replay
    # ------------------------------------------------------------------

    async def replay_missed(self, channel: str) -> int:
        """Replay pending events for *channel* through registered handlers.

        Returns the number of events replayed.
        """
        key = _pending_key(channel)
        raw_items: list[str] = await self._redis.lrange(key, 0, -1)
        handlers = self._handlers.get(channel, [])
        if not handlers:
            await logger.awarning(
                "replay_no_handlers",
                channel=channel,
                pending_count=len(raw_items),
            )
            return 0

        replayed = 0
        for item in raw_items:
            try:
                envelope: dict[str, Any] = json.loads(item)
            except (json.JSONDecodeError, TypeError):
                # Corrupt entry — remove it
                await self._redis.lrem(key, 1, item)
                continue

            event_id = envelope.get("event_id", "")
            payload = envelope.get("payload", {})

            all_succeeded = True
            for handler in handlers:
                try:
                    await handler(payload)
                except Exception:
                    await logger.aexception(
                        "replay_handler_error",
                        channel=channel,
                        event_id=event_id,
                        handler=handler.__name__,
                    )
                    all_succeeded = False
                    break  # Stop trying handlers for this event

            if all_succeeded:
                # Only acknowledge after all handlers succeed
                await self._redis.lrem(key, 1, item)
                replayed += 1

        await logger.ainfo(
            "replay_complete",
            channel=channel,
            replayed=replayed,
        )
        return replayed

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start_listening(self, *, startup_replay: bool = False) -> None:
        """Start the inner event bus listener.

        Parameters
        ----------
        startup_replay:
            If *True*, :meth:`replay_missed` is called for every subscribed
            channel before the real-time listener starts.
        """
        if startup_replay:
            for channel in self._handlers:
                await self.replay_missed(channel)
        await self._inner.start_listening()

    async def close(self) -> None:
        """Shut down both the inner event bus and the Redis connection."""
        await self._inner.close()
        await self._redis.aclose()
        await logger.ainfo("reliable_event_bus_closed")
