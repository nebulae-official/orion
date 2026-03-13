"""FastAPI dependency providers for the Publisher service."""

from __future__ import annotations

from orion_common.event_bus import EventBus

_event_bus: EventBus | None = None


def init_event_bus(redis_url: str) -> EventBus:
    """Create and store the shared EventBus instance (called during startup)."""
    global _event_bus  # noqa: PLW0603
    _event_bus = EventBus(redis_url)
    return _event_bus


async def shutdown_event_bus() -> None:
    """Close the shared EventBus (called during shutdown)."""
    global _event_bus  # noqa: PLW0603
    if _event_bus is not None:
        await _event_bus.close()
        _event_bus = None


def get_event_bus() -> EventBus:
    """FastAPI dependency that returns the shared EventBus instance."""
    if _event_bus is None:
        raise RuntimeError("EventBus not initialised — is the app lifespan running?")
    return _event_bus
