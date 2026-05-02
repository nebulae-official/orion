"""Multi-tier API key resolver for the Provider Service.

Resolution order:
  1. Per-user key     — from Identity service, keyed by X-User-ID + provider
  2. System key       — admin-configured in Identity, TTL-cached 5 minutes per provider
  3. Env-var key      — NVIDIA_NIM_API_KEY / HF_TOKEN (dev/smoke-test bootstrap)
  4. Anonymous tier   — pollinations/huggingface work without a key (rate-limited)
  5. KeyUnavailableError — raises 503 at the route layer

The provider name is passed per-call so a single KeyResolver instance can
serve multiple providers without requiring separate instances per provider.
"""

from __future__ import annotations

import os
import time

import structlog
from orion_common.identity_client import IdentityClient

logger = structlog.get_logger(__name__)

_SYSTEM_KEY_TTL = 300.0  # 5 minutes

# Env vars checked as a last-resort bootstrap tier (dev / smoke-test only).
# These are NOT the preferred path — set keys via Admin → API Keys for production.
_PROVIDER_ENV_VARS: dict[str, str] = {
    "nvidia_nim": "NVIDIA_NIM_API_KEY",
    "huggingface": "HF_TOKEN",
}

# Providers that accept anonymous (empty key) requests — rate-limited but functional.
_ANONYMOUS_PROVIDERS: frozenset[str] = frozenset({"huggingface", "pollinations"})


class KeyUnavailableError(Exception):
    """Raised when no API key is available for the requested provider."""


class KeyResolver:
    """Resolves provider API keys with a multi-tier fallback strategy.

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

        Resolution order: per-user DB key → system DB key → env var → anonymous.
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

        env_var = _PROVIDER_ENV_VARS.get(provider)
        if env_var:
            env_key = os.getenv(env_var, "")
            if env_key:
                await logger.ainfo("key_resolved_env", provider=provider, var=env_var)
                return env_key

        if provider in _ANONYMOUS_PROVIDERS:
            await logger.ainfo("key_resolved_anonymous", provider=provider)
            return ""

        raise KeyUnavailableError(
            f"No API key configured for provider '{provider}'. "
            "Set a system key via Admin → API Keys or configure a per-user key."
        )
