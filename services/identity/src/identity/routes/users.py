"""Public user management routes — proxied through the Go gateway."""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from orion_common.db.session import get_session
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import user_repo
from ..services.auth_service import hash_password, verify_password
from ..services.email_service import send_invite_email

logger = structlog.get_logger()

router = APIRouter(tags=["users"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    timezone: str
    role: str
    email_verified: bool
    is_active: bool
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    timezone: str | None = None
    avatar_url: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserSettingsResponse(BaseModel):
    settings: dict


class UpdateSettingsRequest(BaseModel):
    settings: dict


class InviteRequest(BaseModel):
    email: str
    name: str
    role: str = "editor"


class ChangeRoleRequest(BaseModel):
    role: str


class ChangeStatusRequest(BaseModel):
    is_active: bool


class UserListResponse(BaseModel):
    users: list[UserProfile]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_user_id(request: Request) -> uuid.UUID:
    """Extract X-User-ID header set by the gateway."""
    raw = request.headers.get("X-User-ID")
    if not raw:
        raise HTTPException(status_code=401, detail="Missing user context")
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")


def _get_user_role(request: Request) -> str:
    """Extract X-User-Role header set by the gateway."""
    return request.headers.get("X-User-Role", "viewer")


def _require_admin(request: Request) -> None:
    """Raise 403 if the caller is not an admin."""
    if _get_user_role(request) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _user_to_profile(user) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        timezone=user.timezone,
        role=user.role,
        email_verified=user.email_verified,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Endpoints — Current user
# ---------------------------------------------------------------------------


@router.get("/users/me", response_model=UserProfile)
async def get_me(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """Return the current user's profile."""
    user_id = _get_user_id(request)
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile(user)


@router.put("/users/me", response_model=UserProfile)
async def update_me(
    request: Request,
    body: UpdateProfileRequest,
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """Update the current user's profile fields."""
    user_id = _get_user_id(request)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    user = await user_repo.update_user(session, user_id, **updates)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile(user)


@router.get("/users/me/settings", response_model=UserSettingsResponse)
async def get_my_settings(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserSettingsResponse:
    """Return the current user's settings."""
    user_id = _get_user_id(request)
    settings = await user_repo.get_user_settings(session, user_id)
    if settings is None:
        return UserSettingsResponse(settings={})
    return UserSettingsResponse(settings=settings.settings)


@router.put("/users/me/settings", response_model=UserSettingsResponse)
async def update_my_settings(
    request: Request,
    body: UpdateSettingsRequest,
    session: AsyncSession = Depends(get_session),
) -> UserSettingsResponse:
    """Partially merge into the current user's settings."""
    user_id = _get_user_id(request)
    settings = await user_repo.upsert_user_settings(session, user_id, body.settings)
    return UserSettingsResponse(settings=settings.settings)


@router.put("/users/me/password", status_code=204)
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Change the current user's password."""
    user_id = _get_user_id(request)
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.password_hash is None:
        raise HTTPException(
            status_code=400,
            detail="Account uses OAuth login — set a password via the set-password flow",
        )

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    await session.flush()


# ---------------------------------------------------------------------------
# Endpoints — Admin
# ---------------------------------------------------------------------------


@router.get("/users", response_model=UserListResponse)
async def list_users(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    role: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> UserListResponse:
    """List all users (admin only)."""
    _require_admin(request)
    users, total = await user_repo.list_users(
        session,
        page=page,
        page_size=page_size,
        role_filter=role,
        active_filter=active,
    )
    return UserListResponse(
        users=[_user_to_profile(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/users/invite", response_model=UserProfile, status_code=201)
async def invite_user(
    request: Request,
    body: InviteRequest,
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """Create a stub user and send an invitation email (admin only)."""
    _require_admin(request)

    existing = await user_repo.get_by_email(session, body.email)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = await user_repo.create_user(
        session,
        email=body.email,
        password_hash=None,
        name=body.name,
        role=body.role,
    )

    invite_url = f"https://orion.local/invite?email={body.email}"
    await send_invite_email(body.email, invite_url)

    return _user_to_profile(user)


@router.put("/users/{user_id}/role", response_model=UserProfile)
async def change_role(
    user_id: uuid.UUID,
    body: ChangeRoleRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """Change a user's role (admin only)."""
    _require_admin(request)

    valid_roles = {"admin", "editor", "viewer"}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(valid_roles))}",
        )

    user = await user_repo.update_user(session, user_id, role=body.role)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile(user)


@router.put("/users/{user_id}/status", response_model=UserProfile)
async def change_status(
    user_id: uuid.UUID,
    body: ChangeStatusRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    """Enable or disable a user (admin only)."""
    _require_admin(request)
    user = await user_repo.update_user(session, user_id, is_active=body.is_active)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile(user)
