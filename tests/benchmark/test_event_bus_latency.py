"""Benchmark Redis pub/sub event bus latency."""

import asyncio
import time

import pytest
import redis.asyncio as aioredis


REDIS_URL = "redis://localhost:6379"


@pytest.fixture(scope="module")
def redis_client():
    client = aioredis.from_url(REDIS_URL)
    yield client
    asyncio.get_event_loop().run_until_complete(client.aclose())


def test_pubsub_round_trip(benchmark, redis_client) -> None:
    """Measure pub/sub round-trip time."""

    async def _round_trip():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("bench_channel")
        await pubsub.get_message(timeout=1)

        start = time.perf_counter()
        await redis_client.publish("bench_channel", b"bench_payload")
        msg = await pubsub.get_message(timeout=5)
        elapsed = time.perf_counter() - start

        await pubsub.unsubscribe("bench_channel")
        await pubsub.aclose()
        return elapsed

    def _sync_wrapper():
        return asyncio.get_event_loop().run_until_complete(_round_trip())

    benchmark(_sync_wrapper)
