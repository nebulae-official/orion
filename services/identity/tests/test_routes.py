"""Tests for Identity service routes."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_authenticate_valid_credentials(
    client: AsyncClient,
    sample_user: MagicMock,
) -> None:
    """Successful authentication returns user info and refresh token."""
    with (
        patch(
            "src.identity.routes.auth.authenticate_user",
            new_callable=AsyncMock,
            return_value=sample_user,
        ),
        patch(
            "src.identity.routes.auth.generate_refresh_token",
            return_value=("raw_token_abc", "hashed_token_abc"),
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_refresh_token",
            new_callable=AsyncMock,
        ),
        patch("src.identity.routes.auth.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.post(
            "/internal/users/authenticate",
            json={"email": "test@example.com", "password": "secret123"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "editor"
    assert data["refresh_token"] == "raw_token_abc"


@pytest.mark.asyncio
async def test_authenticate_invalid_credentials(client: AsyncClient) -> None:
    """Invalid credentials return 401."""
    from fastapi import HTTPException

    with (
        patch(
            "src.identity.routes.auth.authenticate_user",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=401, detail="Invalid email or password"),
        ),
        patch("src.identity.routes.auth.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.post(
            "/internal/users/authenticate",
            json={"email": "wrong@example.com", "password": "bad"},
        )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_user_profile(
    client: AsyncClient,
    sample_user: MagicMock,
) -> None:
    """GET /users/me returns the current user's profile."""
    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=sample_user,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.get(
            "/users/me",
            headers={
                "X-User-ID": str(sample_user.id),
                "X-User-Role": "editor",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"


@pytest.mark.asyncio
async def test_update_user_profile(
    client: AsyncClient,
    sample_user: MagicMock,
) -> None:
    """PUT /users/me updates and returns the profile."""
    updated_user = MagicMock()
    updated_user.id = sample_user.id
    updated_user.email = sample_user.email
    updated_user.name = "Updated Name"
    updated_user.avatar_url = None
    updated_user.bio = "New bio"
    updated_user.timezone = "UTC"
    updated_user.role = "editor"
    updated_user.email_verified = False
    updated_user.is_active = True
    updated_user.created_at = sample_user.created_at

    with (
        patch(
            "src.identity.routes.users.user_repo.update_user",
            new_callable=AsyncMock,
            return_value=updated_user,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.put(
            "/users/me",
            headers={
                "X-User-ID": str(sample_user.id),
                "X-User-Role": "editor",
            },
            json={"name": "Updated Name", "bio": "New bio"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["bio"] == "New bio"


@pytest.mark.asyncio
async def test_refresh_token_rotation(
    client: AsyncClient,
    sample_user: MagicMock,
) -> None:
    """POST /internal/tokens/refresh rotates the token."""
    stored_token = MagicMock()
    stored_token.id = uuid.uuid4()
    stored_token.user_id = sample_user.id
    stored_token.revoked = False
    stored_token.expires_at = datetime.now(UTC) + timedelta(days=30)

    with (
        patch(
            "src.identity.routes.auth.user_repo.get_refresh_token",
            new_callable=AsyncMock,
            return_value=stored_token,
        ),
        patch(
            "src.identity.routes.auth.user_repo.revoke_refresh_token",
            new_callable=AsyncMock,
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_refresh_token",
            new_callable=AsyncMock,
        ),
        patch(
            "src.identity.routes.auth.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=sample_user,
        ),
        patch(
            "src.identity.routes.auth.generate_refresh_token",
            return_value=("new_raw_token", "new_hashed_token"),
        ),
        patch("src.identity.routes.auth.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.post(
            "/internal/tokens/refresh",
            json={"refresh_token": "old_raw_token"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["new_refresh_token"] == "new_raw_token"
    assert data["user_id"] == str(sample_user.id)


@pytest.mark.asyncio
async def test_get_me_without_user_header(client: AsyncClient) -> None:
    """GET /users/me without X-User-ID returns 401."""
    resp = await client.get("/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_users_non_admin(
    client: AsyncClient,
) -> None:
    """GET /users as non-admin returns 403."""
    resp = await client.get(
        "/users",
        headers={
            "X-User-ID": str(uuid.uuid4()),
            "X-User-Role": "editor",
        },
    )
    assert resp.status_code == 403
