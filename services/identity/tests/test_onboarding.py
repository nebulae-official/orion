"""Integration tests for the onboarding feature (PUT /users/me/onboarding, GET /users/check-username, OAuth link)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_ID_2 = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _make_oauth_user(
    user_id: uuid.UUID = USER_ID,
    *,
    email: str = "oauth@example.com",
    name: str = "OAuth User",
    password_hash: str | None = None,
    username: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> MagicMock:
    """Create a mock User that simulates an OAuth-only account (no password)."""
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.name = name
    user.role = "editor"
    user.avatar_url = None
    user.bio = None
    user.timezone = "UTC"
    user.email_verified = True
    user.is_active = True
    user.password_hash = password_hash
    user.username = username
    user.first_name = first_name
    user.last_name = last_name
    user.last_login_at = None
    user.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    user.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    return user


# ---------------------------------------------------------------------------
# PUT /users/me/onboarding
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_complete_onboarding_success(client: AsyncClient) -> None:
    """OAuth user completes onboarding: sets username, password, and profile fields."""
    user = _make_oauth_user()

    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch(
            "src.identity.routes.users.user_repo.get_by_username",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "src.identity.routes.users.hash_password",
            return_value="$2b$12$hashedvalue",
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.put(
            "/users/me/onboarding",
            headers={"X-User-ID": str(USER_ID), "X-User-Role": "editor"},
            json={
                "username": "testuser",
                "password": "securepass123",
                "first_name": "Test",
                "last_name": "User",
                "timezone": "America/New_York",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["email"] == "oauth@example.com"
    assert data["name"] == "OAuth User"
    assert data["role"] == "editor"

    # Verify mutations were applied to the user object
    assert user.username == "testuser"
    assert user.password_hash == "$2b$12$hashedvalue"
    assert user.first_name == "Test"
    assert user.last_name == "User"
    assert user.timezone == "America/New_York"


@pytest.mark.asyncio
async def test_complete_onboarding_already_completed(client: AsyncClient) -> None:
    """User who already has a password cannot onboard again (409)."""
    user = _make_oauth_user(password_hash="$2b$12$existinghash")

    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.put(
            "/users/me/onboarding",
            headers={"X-User-ID": str(USER_ID), "X-User-Role": "editor"},
            json={"username": "testuser", "password": "securepass123"},
        )

    assert resp.status_code == 409
    assert "already completed" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_complete_onboarding_username_taken(client: AsyncClient) -> None:
    """Second user cannot claim a username already taken by the first (409)."""
    user_a = _make_oauth_user(USER_ID)
    user_b = _make_oauth_user(USER_ID_2, email="other@example.com")

    existing_user = _make_oauth_user(username="testuser")

    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=user_b,
        ),
        patch(
            "src.identity.routes.users.user_repo.get_by_username",
            new_callable=AsyncMock,
            return_value=existing_user,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.put(
            "/users/me/onboarding",
            headers={"X-User-ID": str(USER_ID_2), "X-User-Role": "editor"},
            json={"username": "testuser", "password": "securepass123"},
        )

    assert resp.status_code == 409
    assert "username already taken" in resp.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_username",
    [
        "has spaces",
        "UPPERCASE",
        "special!chars",
        "with@symbol",
        "dot.name",
    ],
)
async def test_complete_onboarding_invalid_username_format(
    client: AsyncClient,
    bad_username: str,
) -> None:
    """Usernames with invalid characters are rejected with 422."""
    resp = await client.put(
        "/users/me/onboarding",
        headers={"X-User-ID": str(USER_ID), "X-User-Role": "editor"},
        json={"username": bad_username, "password": "securepass123"},
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_complete_onboarding_username_too_short(client: AsyncClient) -> None:
    """Username with fewer than 3 characters is rejected (422)."""
    resp = await client.put(
        "/users/me/onboarding",
        headers={"X-User-ID": str(USER_ID), "X-User-Role": "editor"},
        json={"username": "ab", "password": "securepass123"},
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_complete_onboarding_password_too_short(client: AsyncClient) -> None:
    """Password with fewer than 8 characters is rejected (422)."""
    resp = await client.put(
        "/users/me/onboarding",
        headers={"X-User-ID": str(USER_ID), "X-User-Role": "editor"},
        json={"username": "validname", "password": "short12"},
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_complete_onboarding_missing_auth(client: AsyncClient) -> None:
    """Calling onboarding without X-User-ID returns 401."""
    resp = await client.put(
        "/users/me/onboarding",
        json={"username": "testuser", "password": "securepass123"},
    )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /users/check-username
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_username_available(client: AsyncClient) -> None:
    """Username that does not exist returns available=true."""
    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_username",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.get(
            "/users/check-username",
            params={"username": "newname"},
            headers={"X-User-ID": str(USER_ID)},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is True
    assert data["username"] == "newname"


@pytest.mark.asyncio
async def test_check_username_taken(client: AsyncClient) -> None:
    """Username that already exists returns available=false."""
    existing = _make_oauth_user(username="taken")

    with (
        patch(
            "src.identity.routes.users.user_repo.get_by_username",
            new_callable=AsyncMock,
            return_value=existing,
        ),
        patch("src.identity.routes.users.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.get(
            "/users/check-username",
            params={"username": "taken"},
            headers={"X-User-ID": str(USER_ID)},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is False
    assert data["username"] == "taken"


@pytest.mark.asyncio
async def test_check_username_invalid_format(client: AsyncClient) -> None:
    """check-username with too-short query param returns 422."""
    resp = await client.get(
        "/users/check-username",
        params={"username": "ab"},
        headers={"X-User-ID": str(USER_ID)},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /internal/users/oauth/link  (needs_onboarding flag)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_oauth_link_new_user_needs_onboarding(client: AsyncClient) -> None:
    """New OAuth user is created with needs_onboarding=true and email_verified=True."""
    new_user = _make_oauth_user()

    with (
        patch(
            "src.identity.routes.auth.user_repo.get_oauth_account",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "src.identity.routes.auth.user_repo.get_by_email",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_user",
            new_callable=AsyncMock,
            return_value=new_user,
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_oauth_account",
            new_callable=AsyncMock,
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_refresh_token",
            new_callable=AsyncMock,
        ),
        patch(
            "src.identity.routes.auth.generate_refresh_token",
            return_value=("raw_token", "hashed_token"),
        ),
        patch("src.identity.routes.auth.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.post(
            "/internal/users/oauth/link",
            json={
                "provider": "github",
                "provider_user_id": "gh_12345",
                "email": "oauth@example.com",
                "name": "OAuth User",
                "avatar_url": "https://github.com/avatar.png",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["needs_onboarding"] is True
    assert data["email"] == "oauth@example.com"
    # The route sets email_verified = True on newly created OAuth users
    assert new_user.email_verified is True


@pytest.mark.asyncio
async def test_oauth_link_existing_user_completed_onboarding(
    client: AsyncClient,
) -> None:
    """Existing user with password_hash set returns needs_onboarding=false."""
    existing_user = _make_oauth_user(password_hash="$2b$12$existinghash")

    mock_oauth = MagicMock()
    mock_oauth.user_id = existing_user.id

    with (
        patch(
            "src.identity.routes.auth.user_repo.get_oauth_account",
            new_callable=AsyncMock,
            return_value=mock_oauth,
        ),
        patch(
            "src.identity.routes.auth.user_repo.get_by_id",
            new_callable=AsyncMock,
            return_value=existing_user,
        ),
        patch(
            "src.identity.routes.auth.user_repo.create_refresh_token",
            new_callable=AsyncMock,
        ),
        patch(
            "src.identity.routes.auth.generate_refresh_token",
            return_value=("raw_token", "hashed_token"),
        ),
        patch("src.identity.routes.auth.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(return_value=iter([mock_session]))

        resp = await client.post(
            "/internal/users/oauth/link",
            json={
                "provider": "github",
                "provider_user_id": "gh_67890",
                "email": "oauth@example.com",
                "name": "OAuth User",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["needs_onboarding"] is False
