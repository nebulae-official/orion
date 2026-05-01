"""Async HTTP client for fetching per-user API keys from the Identity service.

Pipeline services (Director, Media, etc.) use this to retrieve the
user's stored API key for a given provider rather than falling back to
environment-variable defaults.  The Identity service decrypts the key
before returning it, so callers receive a plain-text secret.

Usage::

    client = IdentityClient(
        base_url=settings.identity_url,
        internal_token=settings.internal_token,
    )
    key = await client.get_api_key(user_id="<uuid>", provider="openai")
    # key is the raw API key string, or None if not stored for this user
"""

from __future__ import annotations

import httpx
import structlog

logger = structlog.get_logger(__name__)


class IdentityClient:
    """Thin async wrapper around the Identity service ``/api/v1/keys`` endpoint."""

    def __init__(
        self,
        base_url: str,
        internal_token: str,
        timeout: float = 5.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {
            "X-Internal-Token": internal_token,
            "Content-Type": "application/json",
        }
        self._timeout = timeout

    async def get_api_key(self, user_id: str, provider: str) -> str | None:
        """Return the decrypted API key for *user_id* / *provider*, or ``None``.

        Returns ``None`` when:
        - the user has not stored a key for that provider, or
        - the Identity service is unreachable (degraded gracefully).
        """
        url = f"{self._base_url}/api/v1/keys/{provider}"
        headers = {**self._headers, "X-User-ID": user_id}

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 404:
                return None

            resp.raise_for_status()
            data = resp.json()
            return data.get("api_key")  # type: ignore[return-value]

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "identity_key_fetch_http_error",
                user_id=user_id,
                provider=provider,
                status=exc.response.status_code,
            )
            return None
        except Exception:  # Identity service down — fall back to env gracefully
            logger.warning(
                "identity_key_fetch_failed",
                user_id=user_id,
                provider=provider,
            )
            return None

    async def get_system_api_key(self, provider: str) -> str | None:
        """Return the decrypted system-level API key for *provider*, or ``None``.

        Returns ``None`` when:
        - no admin has configured a key for that provider, or
        - the Identity service is unreachable (degrades gracefully).
        """
        url = f"{self._base_url}/api/v1/internal/system-keys/{provider}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers)

            if resp.status_code == 404:
                return None

            resp.raise_for_status()
            data = resp.json()
            return data.get("key")  # type: ignore[return-value]

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "identity_system_key_fetch_http_error",
                provider=provider,
                status=exc.response.status_code,
            )
            return None
        except Exception:  # Identity service down — treat as not configured
            logger.warning("identity_system_key_fetch_failed", provider=provider)
            return None
