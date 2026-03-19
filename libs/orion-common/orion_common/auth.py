"""User context utilities for Orion Python services.

The Go gateway validates JWTs and forwards user identity via headers.
These dependencies extract that context for use in FastAPI route handlers.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request


@dataclass
class CurrentUser:
    """Authenticated user context forwarded by the gateway."""

    user_id: str
    role: str
    email: str

    @property
    def is_admin(self) -> bool:
        """Return True if the user has the admin role."""
        return self.role == "admin"


def get_current_user(request: Request) -> CurrentUser:
    """Extract user context from gateway-forwarded headers.

    The Go gateway sets ``X-User-ID``, ``X-User-Role``, and ``X-User-Email``
    headers after validating the JWT.  This dependency reads those headers
    and raises 401 if the user identity is missing.
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user context")
    return CurrentUser(
        user_id=user_id,
        role=request.headers.get("X-User-Role", "viewer"),
        email=request.headers.get("X-User-Email", ""),
    )


def get_optional_user(request: Request) -> CurrentUser | None:
    """Extract user context if present, None otherwise.

    Useful for endpoints that behave differently for authenticated vs.
    anonymous requests (e.g. public read with optional ownership check).
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return None
    return CurrentUser(
        user_id=user_id,
        role=request.headers.get("X-User-Role", "viewer"),
        email=request.headers.get("X-User-Email", ""),
    )
