"""Authentication service — password hashing, token generation, user verification."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import structlog
from fastapi import HTTPException
from orion_common.db.models import User
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import user_repo

logger = structlog.get_logger()

# Refresh tokens expire after 30 days by default.
REFRESH_TOKEN_TTL_DAYS = 30


def hash_password(password: str) -> str:
    """Hash password with bcrypt cost factor 12."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_refresh_token() -> tuple[str, str]:
    """Generate a refresh token pair.

    Returns
    -------
    tuple[str, str]
        ``(raw_token, token_hash)`` — the raw token is sent to the client,
        the SHA-256 hash is stored in the database.
    """
    raw_token = secrets.token_hex(64)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> User:
    """Verify email/username + password and return the user.

    Accepts either an email address or a username (name field). If the input
    contains ``@`` it is treated as an email lookup; otherwise as a name lookup.

    Raises
    ------
    HTTPException(401)
        If the user is not found, the account is inactive, or the password
        does not match.
    """
    if "@" in email:
        user = await user_repo.get_by_email(session, email)
    else:
        user = await user_repo.get_by_name(session, email)
    if user is None:
        logger.warning("auth_failed_unknown_user", identifier=email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        logger.warning("auth_failed_inactive", user_id=str(user.id))
        raise HTTPException(status_code=401, detail="Account is disabled")

    if user.password_hash is None:
        logger.warning("auth_failed_no_password", user_id=str(user.id))
        raise HTTPException(
            status_code=401,
            detail="Account uses OAuth login only",
        )

    if not verify_password(password, user.password_hash):
        logger.warning("auth_failed_bad_password", user_id=str(user.id))
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last login timestamp
    user.last_login_at = datetime.now(UTC)
    await session.flush()

    return user


def refresh_token_expires_at() -> datetime:
    """Return the default expiry timestamp for a new refresh token."""
    return datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_TTL_DAYS)
