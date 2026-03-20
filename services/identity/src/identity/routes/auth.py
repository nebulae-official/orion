"""Internal auth routes — called by the Go gateway, not directly by clients."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException
from orion_common.db.session import get_session
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import user_repo
from ..services.auth_service import (
    authenticate_user,
    generate_refresh_token,
    refresh_token_expires_at,
)

logger = structlog.get_logger()

router = APIRouter(tags=["auth"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AuthenticateRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    role: str
    name: str
    avatar_url: str | None = None
    refresh_token: str | None = None
    needs_onboarding: bool = False


class OAuthLinkRequest(BaseModel):
    provider: str
    provider_user_id: str
    email: str
    name: str
    access_token: str | None = None
    avatar_url: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    user_id: str
    email: str
    role: str
    new_refresh_token: str


class RevokeRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/users/authenticate", response_model=AuthResponse)
async def authenticate(
    body: AuthenticateRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Verify email + password and return user info with a refresh token."""
    user = await authenticate_user(session, body.email, body.password)

    # Generate a refresh token
    raw_token, token_hash = generate_refresh_token()
    await user_repo.create_refresh_token(
        session,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=refresh_token_expires_at(),
    )

    return AuthResponse(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        name=user.name,
        avatar_url=user.avatar_url,
        refresh_token=raw_token,
    )


@router.post("/users/oauth/link", response_model=AuthResponse)
async def oauth_link(
    body: OAuthLinkRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Find-or-create a user via OAuth provider, return user info."""
    # Check if OAuth account already exists
    oauth = await user_repo.get_oauth_account(session, body.provider, body.provider_user_id)

    if oauth is not None:
        # Existing OAuth link — load the user
        user = await user_repo.get_by_id(session, oauth.user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Linked user not found")

        # Update last login
        user.last_login_at = datetime.now(UTC)
        await session.flush()
    else:
        # Try to find an existing user by email
        user = await user_repo.get_by_email(session, body.email)
        if user is None:
            # Create new user (OAuth-only, no password)
            user = await user_repo.create_user(
                session,
                email=body.email,
                password_hash=None,
                name=body.name,
                role="editor",
            )
            user.email_verified = True
            if body.avatar_url:
                user.avatar_url = body.avatar_url
            await session.flush()

        # Link OAuth account
        await user_repo.create_oauth_account(
            session,
            user_id=user.id,
            provider=body.provider,
            provider_user_id=body.provider_user_id,
            provider_email=body.email,
            access_token=body.access_token,
        )

        user.last_login_at = datetime.now(UTC)
        await session.flush()

    # Generate refresh token
    raw_token, token_hash = generate_refresh_token()
    await user_repo.create_refresh_token(
        session,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=refresh_token_expires_at(),
    )

    needs_onboarding = user.password_hash is None

    return AuthResponse(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        name=user.name,
        avatar_url=user.avatar_url,
        refresh_token=raw_token,
        needs_onboarding=needs_onboarding,
    )


@router.post("/tokens/refresh", response_model=RefreshResponse)
async def refresh_token(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> RefreshResponse:
    """Validate a refresh token, rotate it, and return a new one."""
    incoming_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    stored = await user_repo.get_refresh_token(session, incoming_hash)

    if stored is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if stored.revoked:
        logger.warning("refresh_token_reuse_detected", user_id=str(stored.user_id))
        # Potential token theft — revoke all tokens for this user
        await user_repo.revoke_all_user_tokens(session, stored.user_id)
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    if stored.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh token has expired")

    # Revoke the old token
    await user_repo.revoke_refresh_token(session, stored.id)

    # Issue a new one
    new_raw, new_hash = generate_refresh_token()
    await user_repo.create_refresh_token(
        session,
        user_id=stored.user_id,
        token_hash=new_hash,
        expires_at=refresh_token_expires_at(),
    )

    user = await user_repo.get_by_id(session, stored.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return RefreshResponse(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
        new_refresh_token=new_raw,
    )


@router.post("/tokens/revoke", status_code=204)
async def revoke_token(
    body: RevokeRequest,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Revoke a refresh token."""
    incoming_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    stored = await user_repo.get_refresh_token(session, incoming_hash)

    if stored is not None and not stored.revoked:
        await user_repo.revoke_refresh_token(session, stored.id)
