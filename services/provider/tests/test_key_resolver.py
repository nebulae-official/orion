"""Unit tests for KeyResolver (ORION-248)."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock

import pytest
from src.key_resolver import KeyResolver, KeyUnavailableError


@pytest.fixture
def mock_identity() -> AsyncMock:
    client = AsyncMock()
    client.get_api_key = AsyncMock(return_value=None)
    client.get_system_api_key = AsyncMock(return_value=None)
    return client


@pytest.mark.asyncio
async def test_resolves_per_user_key(mock_identity: AsyncMock) -> None:
    """Per-user key takes priority when user_id is provided."""
    mock_identity.get_api_key.return_value = "user-key-abc"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve("user-123")

    assert key == "user-key-abc"
    mock_identity.get_api_key.assert_awaited_once_with(user_id="user-123", provider="nvidia_nim")
    mock_identity.get_system_api_key.assert_not_awaited()


@pytest.mark.asyncio
async def test_falls_back_to_system_key_when_no_user_key(mock_identity: AsyncMock) -> None:
    """Falls back to system key when per-user key is absent."""
    mock_identity.get_api_key.return_value = None
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve("user-123")

    assert key == "system-key-xyz"


@pytest.mark.asyncio
async def test_uses_system_key_when_no_user_id(mock_identity: AsyncMock) -> None:
    """Uses system key directly when no user_id is provided."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve(None)

    assert key == "system-key-xyz"
    mock_identity.get_api_key.assert_not_awaited()


@pytest.mark.asyncio
async def test_raises_when_no_key_available(mock_identity: AsyncMock) -> None:
    """Raises KeyUnavailableError when neither tier has a key."""
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    with pytest.raises(KeyUnavailableError):
        await resolver.resolve("user-123")


@pytest.mark.asyncio
async def test_system_key_cached_for_5_minutes(mock_identity: AsyncMock) -> None:
    """System key is fetched once and cached for 5 minutes."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key1 = await resolver.resolve(None)
    key2 = await resolver.resolve(None)

    assert key1 == key2 == "system-key-xyz"
    mock_identity.get_system_api_key.assert_awaited_once()


@pytest.mark.asyncio
async def test_system_key_cache_expires(mock_identity: AsyncMock) -> None:
    """Cache is bypassed when TTL has expired."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    await resolver.resolve(None)
    # Manually expire the cache
    resolver._cache_expires_at = time.monotonic() - 1

    await resolver.resolve(None)
    assert mock_identity.get_system_api_key.await_count == 2
