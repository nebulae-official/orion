"""Two-tier API key resolver for the Provider Service.

Resolution order:
  1. Per-user key  — from Identity service, keyed by X-User-ID + provider
  2. System key    — admin-configured in Identity, TTL-cached 5 minutes per provider
  3. KeyUnavailableError — raises 503 at the route layer

The provider name is passed per-call so a single KeyResolver instance can
serve multiple providers without requiring separate instances per provider.
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
    """Resolves provider API keys with a two-tier fallback strategy.

    A single instance handles all providers; the system-key cache is keyed
    by provider name so each provider's TTL is tracked independently.
    """

    def __init__(self, identity_client: IdentityClient, provider: str = "nvidia_nim") -> None:  # noqa: ARG002
        # `provider` kwarg accepted for backward compatibility with existing
        # test fixtures that pass it at construction, but resolution is per-call.
        self._identity_client = identity_client
        # (key, expires_at) stored per provider name
        self._system_key_cache: dict[str, tuple[str, float]] = {}

    async def resolve(self, user_id: str | None, provider: str = "nvidia_nim") -> str:
        """Return an API key or raise KeyUnavailableError.

        Tries per-user key first (when user_id is present), then falls back
        to the cached system key for the given provider. Never reads from
        environment variables.
        """
        if user_id:
            user_key = await self._identity_client.get_api_key(user_id=user_id, provider=provider)
            if user_key:
                await logger.ainfo("key_resolved_per_user", provider=provider)
                return user_key

        cached = self._system_key_cache.get(provider)
        if cached and time.monotonic() < cached[1]:
            return cached[0]

        system_key = await self._identity_client.get_system_api_key(provider)
        if system_key:
            self._system_key_cache[provider] = (system_key, time.monotonic() + _SYSTEM_KEY_TTL)
            await logger.ainfo("key_resolved_system", provider=provider)
            return system_key

        raise KeyUnavailableError(
            f"No API key configured for provider '{provider}'. "
            "Set a system key via Admin → API Keys or configure a per-user key."
        )
