"""Async SQLAlchemy CRUD repository for user-related models."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from orion_common.db.models import OAuthAccount, RefreshToken, User, UserSettings
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Fetch a user by primary key."""
    return await session.get(User, user_id)


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    """Fetch a user by email address."""
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_by_name(session: AsyncSession, name: str) -> User | None:
    """Fetch a user by name (case-insensitive)."""
    stmt = select(User).where(User.name.ilike(name))
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_by_username(session: AsyncSession, username: str) -> User | None:
    """Fetch a user by username (exact match)."""
    stmt = select(User).where(User.username == username)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    email: str,
    password_hash: str | None,
    name: str,
    role: str = "editor",
) -> User:
    """Insert a new user and return it."""
    user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        role=role,
    )
    session.add(user)
    await session.flush()
    return user


async def update_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    **fields: Any,
) -> User | None:
    """Update specific fields on a user record."""
    user = await get_by_id(session, user_id)
    if user is None:
        return None
    for key, value in fields.items():
        setattr(user, key, value)
    await session.flush()
    return user


async def list_users(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    role_filter: str | None = None,
    active_filter: bool | None = None,
) -> tuple[list[User], int]:
    """Return a paginated list of users with total count."""
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    if role_filter is not None:
        stmt = stmt.where(User.role == role_filter)
        count_stmt = count_stmt.where(User.role == role_filter)
    if active_filter is not None:
        stmt = stmt.where(User.is_active == active_filter)
        count_stmt = count_stmt.where(User.is_active == active_filter)

    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.order_by(User.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    return list(result.scalars().all()), total


# ---------------------------------------------------------------------------
# OAuth accounts
# ---------------------------------------------------------------------------


async def get_oauth_account(
    session: AsyncSession,
    provider: str,
    provider_user_id: str,
) -> OAuthAccount | None:
    """Look up an OAuth account by provider + provider user ID."""
    stmt = select(OAuthAccount).where(
        OAuthAccount.provider == provider,
        OAuthAccount.provider_user_id == provider_user_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_oauth_account(
    session: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
    provider_user_id: str,
    provider_email: str | None = None,
    access_token: str | None = None,
    refresh_token: str | None = None,
    token_expires_at: datetime | None = None,
) -> OAuthAccount:
    """Create a new OAuth account link."""
    oauth = OAuthAccount(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expires_at=token_expires_at,
    )
    session.add(oauth)
    await session.flush()
    return oauth


# ---------------------------------------------------------------------------
# User settings
# ---------------------------------------------------------------------------


async def get_user_settings(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> UserSettings | None:
    """Get user settings row."""
    stmt = select(UserSettings).where(UserSettings.user_id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_user_settings(
    session: AsyncSession,
    user_id: uuid.UUID,
    settings: dict[str, Any],
) -> UserSettings:
    """Create or update user settings (partial merge)."""
    existing = await get_user_settings(session, user_id)
    if existing is None:
        user_settings = UserSettings(
            user_id=user_id,
            settings=settings,
        )
        session.add(user_settings)
        await session.flush()
        return user_settings

    # Merge new keys into existing settings
    merged = {**existing.settings, **settings}
    existing.settings = merged
    await session.flush()
    return existing


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------


async def create_refresh_token(
    session: AsyncSession,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
) -> RefreshToken:
    """Persist a new refresh token."""
    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(rt)
    await session.flush()
    return rt


async def get_refresh_token(
    session: AsyncSession,
    token_hash: str,
) -> RefreshToken | None:
    """Look up a refresh token by its SHA-256 hash."""
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def revoke_refresh_token(
    session: AsyncSession,
    token_id: uuid.UUID,
) -> None:
    """Mark a single refresh token as revoked."""
    stmt = (
        update(RefreshToken)
        .where(RefreshToken.id == token_id)
        .values(revoked=True, revoked_at=datetime.now(UTC))
    )
    await session.execute(stmt)
    await session.flush()


async def revoke_all_user_tokens(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    """Revoke all active refresh tokens for a user. Returns count revoked."""
    stmt = (
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked.is_(False),
        )
        .values(revoked=True, revoked_at=datetime.now(UTC))
    )
    result = await session.execute(stmt)
    await session.flush()
    return result.rowcount  # type: ignore[attr-defined]
