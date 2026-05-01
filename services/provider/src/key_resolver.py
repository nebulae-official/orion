"""Two-tier API key resolver for the Provider Service.

Resolution order:
  1. Per-user key  — from Identity service, keyed by X-User-ID
  2. System key    — admin-configured in Identity, TTL-cached 5 minutes
  3. KeyUnavailableError — raises 503 at the route layer
"""

from __future__ import annotations

import time

import structlog
from orion_common.identity_client import IdentityClient

logger = structlog.get_logger(__name__)

_SYSTEM_KEY_TTL = 300.0  # 5 minutes


class KeyUnavailableError(Exception):
    """Raised when no API key is available for the requested provider."""


class KeyResolver:
    """Resolves provider API keys with a two-tier fallback strategy."""

    def __init__(self, identity_client: IdentityClient, provider: str = "nvidia_nim") -> None:
        self._identity_client = identity_client
        self._provider = provider
        self._system_key_cache: str | None = None
        self._cache_expires_at: float = 0.0

    async def resolve(self, user_id: str | None) -> str:
        """Return an API key or raise KeyUnavailableError.

        Tries per-user key first (when user_id is present), then falls back
        to the cached system key. Never reads from environment variables.
        """
        if user_id:
            user_key = await self._identity_client.get_api_key(
                user_id=user_id, provider=self._provider
            )
            if user_key:
                await logger.ainfo("key_resolved_per_user", provider=self._provider)
                return user_key

        if self._system_key_cache and time.monotonic() < self._cache_expires_at:
            return self._system_key_cache

        system_key = await self._identity_client.get_system_api_key(self._provider)
        if system_key:
            self._system_key_cache = system_key
            self._cache_expires_at = time.monotonic() + _SYSTEM_KEY_TTL
            await logger.ainfo("key_resolved_system", provider=self._provider)
            return system_key

        raise KeyUnavailableError(
            f"No API key configured for provider '{self._provider}'. "
            "Set a system key via Admin → API Keys or configure a per-user key."
        )
