"""Internal authentication middleware for Orion Python services.

This middleware validates an internal service token on incoming requests.
The Go gateway should set the ``X-Internal-Token`` header when proxying
requests to Python services.

Behaviour:
- If ``ORION_INTERNAL_TOKEN`` is not set (empty string), validation is
  skipped entirely — this is the default development mode.
- If set, every request (except health endpoints) must carry either:
  1. A matching ``X-Internal-Token`` header, **or**
  2. A valid ``Authorization: Bearer <token>`` header whose value equals
     the internal token (fallback for direct access during development).
- ``/health`` and ``/ready`` endpoints are always exempt.
"""

from __future__ import annotations

from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

logger = structlog.get_logger(__name__)

# Paths that are always allowed without authentication.
_EXEMPT_PATHS: frozenset[str] = frozenset({"/health", "/ready"})


class InternalAuthMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that validates the ``X-Internal-Token`` header.

    Parameters
    ----------
    app:
        The ASGI application to wrap.
    token:
        The expected internal token value.  When empty, all requests are
        allowed (development mode).
    """

    def __init__(self, app: ASGIApp, token: str = "") -> None:
        super().__init__(app)
        self._token: str = token

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],  # type: ignore[type-arg]
    ) -> Response:
        """Check the internal token on every non-exempt request."""
        # Development mode — skip validation when no token is configured.
        if not self._token:
            return await call_next(request)

        # Always allow health endpoints through.
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        # Check X-Internal-Token header first.
        header_token: str | None = request.headers.get("X-Internal-Token")
        if header_token == self._token:
            return await call_next(request)

        # Fallback: check Authorization Bearer token.
        auth_header: str | None = request.headers.get("Authorization")
        if auth_header is not None:
            parts = auth_header.split(" ", 1)
            if len(parts) == 2 and parts[0].lower() == "bearer":
                if parts[1] == self._token:
                    return await call_next(request)

        logger.warning(
            "internal_auth_rejected",
            path=request.url.path,
            method=request.method,
        )
        return JSONResponse(
            status_code=403,
            content={"detail": "Invalid or missing internal service token"},
        )
