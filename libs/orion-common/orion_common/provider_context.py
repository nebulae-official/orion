"""Shared async context variables for provider service requests."""

from __future__ import annotations

import contextvars

# Per-async-task user ID forwarded to the Provider Service as X-User-ID.
# Set this before calling into any service that proxies to the Provider Service
# so per-user credentials can be resolved there.
# Each asyncio.Task gets its own copy, keeping concurrent requests isolated.
request_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "provider_request_user_id", default=None
)
