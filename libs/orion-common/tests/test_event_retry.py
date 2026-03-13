"""Tests for the ReliableEventBus retry / acknowledgment layer."""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, patch

import fakeredis.aioredis
import pytest

from orion_common.event_retry import ReliableEventBus, _pending_key


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_bus(fake_redis: fakeredis.aioredis.FakeRedis) -> ReliableEventBus:
    """Create a ReliableEventBus wired to a fakeredis instance."""
    bus = ReliableEventBus.__new__(ReliableEventBus)
    # Bypass __init__ and inject fakes directly.
    bus._redis = fake_redis
    bus._event_ttl = 86400
    bus._handlers = {}

    # Create a real inner EventBus but patch its Redis too.
    from orion_common.event_bus import EventBus

    inner = EventBus.__new__(EventBus)
    inner._redis = fake_redis
    inner._pubsub = fake_redis.pubsub()
    inner._handlers = {}
    inner._listener_task = None
    bus._inner = inner
    return bus


@pytest.fixture
def fake_redis() -> fakeredis.aioredis.FakeRedis:
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
def bus(fake_redis: fakeredis.aioredis.FakeRedis) -> ReliableEventBus:
    return _make_bus(fake_redis)


# ---------------------------------------------------------------------------
# Tests — publish
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_publish_stores_pending_event(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """Published events should appear in the pending list."""
    channel = "orion.test.channel"
    payload: dict[str, Any] = {"key": "value"}

    event_id = await bus.publish(channel, payload)

    key = _pending_key(channel)
    items = await fake_redis.lrange(key, 0, -1)
    assert len(items) == 1

    envelope = json.loads(items[0])
    assert envelope["event_id"] == event_id
    assert envelope["channel"] == channel
    assert envelope["payload"] == payload


@pytest.mark.asyncio
async def test_publish_returns_unique_ids(bus: ReliableEventBus) -> None:
    """Each publish call should return a different event id."""
    id1 = await bus.publish("ch", {"a": 1})
    id2 = await bus.publish("ch", {"b": 2})
    assert id1 != id2


# ---------------------------------------------------------------------------
# Tests — acknowledge
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_acknowledge_removes_event(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """Acknowledging an event should remove it from the pending list."""
    channel = "orion.test.ack"
    event_id = await bus.publish(channel, {"x": 1})

    # Before ack — one item.
    key = _pending_key(channel)
    assert await fake_redis.llen(key) == 1

    await bus.acknowledge(channel, event_id)

    # After ack — empty.
    assert await fake_redis.llen(key) == 0


@pytest.mark.asyncio
async def test_acknowledge_nonexistent_is_noop(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """Acknowledging a non-existent event should not raise."""
    await bus.acknowledge("orion.nope", "fake-id")


# ---------------------------------------------------------------------------
# Tests — subscribe + auto-acknowledge
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_subscribe_wraps_handler_with_ack(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """When a subscribed handler succeeds, the event should be auto-acked."""
    channel = "orion.test.sub"
    received: list[dict[str, Any]] = []

    async def handler(data: dict[str, Any]) -> None:
        received.append(data)

    await bus.subscribe(channel, handler)

    # Publish — this stores in pending AND dispatches via inner bus.
    event_id = await bus.publish(channel, {"msg": "hello"})

    # Simulate message delivery via the inner bus wrapper.
    # The inner bus has a wrapper registered; call it directly.
    inner_handlers = bus._inner._handlers.get(channel, [])
    assert len(inner_handlers) == 1

    await inner_handlers[0]({"msg": "hello", "_event_id": event_id})

    # Handler should have received the payload without _event_id.
    assert len(received) == 1
    assert received[0] == {"msg": "hello"}

    # Pending list should be empty after successful ack.
    key = _pending_key(channel)
    assert await fake_redis.llen(key) == 0


# ---------------------------------------------------------------------------
# Tests — replay_missed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_replay_missed_processes_pending(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """replay_missed should invoke handlers for all pending events."""
    channel = "orion.test.replay"
    received: list[dict[str, Any]] = []

    async def handler(data: dict[str, Any]) -> None:
        received.append(data)

    await bus.subscribe(channel, handler)

    # Manually insert pending events (simulating events published while offline).
    key = _pending_key(channel)
    for i in range(3):
        envelope = {
            "event_id": f"evt-{i}",
            "channel": channel,
            "payload": {"index": i},
        }
        await fake_redis.rpush(key, json.dumps(envelope))

    replayed = await bus.replay_missed(channel)

    assert replayed == 3
    assert len(received) == 3
    assert [r["index"] for r in received] == [0, 1, 2]

    # All events should be removed from pending.
    assert await fake_redis.llen(key) == 0


@pytest.mark.asyncio
async def test_replay_missed_no_handlers(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """replay_missed with no handlers should return 0."""
    channel = "orion.test.nohandler"
    key = _pending_key(channel)
    await fake_redis.rpush(
        key, json.dumps({"event_id": "e1", "channel": channel, "payload": {}})
    )

    replayed = await bus.replay_missed(channel)
    assert replayed == 0

    # Event should remain in pending (not lost).
    assert await fake_redis.llen(key) == 1


@pytest.mark.asyncio
async def test_replay_missed_handler_error_continues(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """If a handler raises during replay, the event is still acknowledged."""
    channel = "orion.test.replay_err"
    call_count = 0

    async def bad_handler(data: dict[str, Any]) -> None:
        nonlocal call_count
        call_count += 1
        raise RuntimeError("boom")

    await bus.subscribe(channel, bad_handler)

    key = _pending_key(channel)
    await fake_redis.rpush(
        key,
        json.dumps({"event_id": "e1", "channel": channel, "payload": {"a": 1}}),
    )

    # replay_missed catches handler errors and continues.
    replayed = await bus.replay_missed(channel)
    assert call_count == 1
    # The event is still counted as replayed (removed from pending).
    assert replayed == 1


# ---------------------------------------------------------------------------
# Tests — start_listening with startup_replay
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_listening_with_startup_replay(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """start_listening(startup_replay=True) should replay before listening."""
    channel = "orion.test.startup"
    received: list[dict[str, Any]] = []

    async def handler(data: dict[str, Any]) -> None:
        received.append(data)

    await bus.subscribe(channel, handler)

    # Insert a pending event.
    key = _pending_key(channel)
    await fake_redis.rpush(
        key,
        json.dumps({"event_id": "s1", "channel": channel, "payload": {"boot": True}}),
    )

    await bus.start_listening(startup_replay=True)

    assert len(received) == 1
    assert received[0] == {"boot": True}
    assert await fake_redis.llen(key) == 0

    # Clean up the listener task.
    await bus.close()


@pytest.mark.asyncio
async def test_start_listening_without_replay(
    bus: ReliableEventBus,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    """start_listening without replay should NOT process pending events."""
    channel = "orion.test.noreplay"

    async def handler(data: dict[str, Any]) -> None:
        pass  # pragma: no cover

    await bus.subscribe(channel, handler)

    key = _pending_key(channel)
    await fake_redis.rpush(
        key,
        json.dumps({"event_id": "n1", "channel": channel, "payload": {}}),
    )

    await bus.start_listening(startup_replay=False)

    # Event should still be pending.
    assert await fake_redis.llen(key) == 1

    await bus.close()


# ---------------------------------------------------------------------------
# Tests — pending key helper
# ---------------------------------------------------------------------------


def test_pending_key_format() -> None:
    """_pending_key should produce the expected Redis key."""
    assert _pending_key("orion.content.created") == "orion:events:pending:orion.content.created"
