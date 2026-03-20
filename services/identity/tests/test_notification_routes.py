"""Integration tests for the notification API endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.identity.routes.notifications import router as notifications_router
from src.identity.schemas.notifications import NotificationOut


USER_ID = "11111111-1111-1111-1111-111111111111"
USER_HEADERS = {"X-User-ID": USER_ID, "X-User-Role": "editor", "X-User-Email": "test@example.com"}


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.publish = AsyncMock(return_value=1)
    return redis


@pytest.fixture
def notification_app(mock_redis: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with notification routes mounted."""
    app = FastAPI(title="Notification Test")
    app.include_router(notifications_router)
    return app


@pytest_asyncio.fixture
async def client(notification_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=notification_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _make_notification_out(**overrides) -> NotificationOut:
    defaults = {
        "id": uuid.uuid4(),
        "type": "trend.detected",
        "title": "New trend detected: AI Coding",
        "body": None,
        "metadata_": None,
        "is_read": False,
        "read_at": None,
        "created_at": datetime(2026, 3, 20, 12, 0, 0, tzinfo=UTC),
    }
    defaults.update(overrides)
    return NotificationOut.model_validate(defaults, from_attributes=True)


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient) -> None:
    """GET /notifications returns paginated notification list."""
    notif = _make_notification_out()

    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.list_notifications.return_value = ([notif], 1)
        mock_get_svc.return_value = mock_svc

        resp = await client.get("/notifications", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert len(data["items"]) == 1
    assert data["items"][0]["type"] == "trend.detected"


@pytest.mark.asyncio
async def test_list_notifications_unread_filter(client: AsyncClient) -> None:
    """GET /notifications?unread=true passes unread filter."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.list_notifications.return_value = ([], 0)
        mock_get_svc.return_value = mock_svc

        resp = await client.get("/notifications?unread=true", headers=USER_HEADERS)

    assert resp.status_code == 200
    mock_svc.list_notifications.assert_awaited_once()
    call_kwargs = mock_svc.list_notifications.call_args[1]
    assert call_kwargs["unread_only"] is True


@pytest.mark.asyncio
async def test_list_notifications_pagination(client: AsyncClient) -> None:
    """GET /notifications respects page and page_size query params."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.list_notifications.return_value = ([], 0)
        mock_get_svc.return_value = mock_svc

        resp = await client.get(
            "/notifications?page=3&page_size=10", headers=USER_HEADERS
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 3
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_list_notifications_requires_auth(client: AsyncClient) -> None:
    """GET /notifications without auth headers returns 401."""
    resp = await client.get("/notifications")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /notifications/{id}/read
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_notification_read(client: AsyncClient) -> None:
    """PATCH /notifications/{id}/read marks a notification as read."""
    notif_id = uuid.uuid4()

    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.mark_read.return_value = True
        mock_get_svc.return_value = mock_svc

        resp = await client.patch(
            f"/notifications/{notif_id}/read", headers=USER_HEADERS
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_mark_notification_read_not_found(client: AsyncClient) -> None:
    """PATCH /notifications/{id}/read returns 404 when not found."""
    notif_id = uuid.uuid4()

    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.mark_read.return_value = False
        mock_get_svc.return_value = mock_svc

        resp = await client.patch(
            f"/notifications/{notif_id}/read", headers=USER_HEADERS
        )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /notifications/read-all
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_all_read(client: AsyncClient) -> None:
    """POST /notifications/read-all marks all as read and returns count."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.mark_all_read.return_value = 5
        mock_get_svc.return_value = mock_svc

        resp = await client.post("/notifications/read-all", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["marked"] == 5


@pytest.mark.asyncio
async def test_mark_all_read_zero(client: AsyncClient) -> None:
    """POST /notifications/read-all returns marked=0 when none are unread."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.mark_all_read.return_value = 0
        mock_get_svc.return_value = mock_svc

        resp = await client.post("/notifications/read-all", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["marked"] == 0


# ---------------------------------------------------------------------------
# GET /notifications/unread-count
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient) -> None:
    """GET /notifications/unread-count returns the count."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.get_unread_count.return_value = 12
        mock_get_svc.return_value = mock_svc

        resp = await client.get("/notifications/unread-count", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["count"] == 12


@pytest.mark.asyncio
async def test_unread_count_zero(client: AsyncClient) -> None:
    """GET /notifications/unread-count returns 0 when all are read."""
    with (
        patch(
            "src.identity.routes.notifications._get_service",
        ) as mock_get_svc,
    ):
        mock_svc = AsyncMock()
        mock_svc.get_unread_count.return_value = 0
        mock_get_svc.return_value = mock_svc

        resp = await client.get("/notifications/unread-count", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert resp.json()["count"] == 0


# ---------------------------------------------------------------------------
# GET /notifications/preferences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_preferences_defaults(client: AsyncClient) -> None:
    """GET /notifications/preferences returns defaults when no settings exist."""
    with (
        patch(
            "src.identity.routes.notifications.user_repo.get_user_settings",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch("src.identity.routes.notifications.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(
            return_value=iter([mock_session])
        )

        resp = await client.get("/notifications/preferences", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    # Default: trend_detected is enabled with push
    assert data["trend_detected"]["enabled"] is True
    assert data["trend_detected"]["push"] is True
    # Default: pipeline_stage_changed is disabled
    assert data["pipeline_stage_changed"]["enabled"] is False
    assert data["pipeline_stage_changed"]["push"] is False


@pytest.mark.asyncio
async def test_get_preferences_with_custom_settings(client: AsyncClient) -> None:
    """GET /notifications/preferences returns user's custom preferences."""
    settings_row = MagicMock()
    settings_row.settings = {
        "notification_preferences": {
            "trend_detected": {"enabled": False, "push": False},
        }
    }

    with (
        patch(
            "src.identity.routes.notifications.user_repo.get_user_settings",
            new_callable=AsyncMock,
            return_value=settings_row,
        ),
        patch("src.identity.routes.notifications.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(
            return_value=iter([mock_session])
        )

        resp = await client.get("/notifications/preferences", headers=USER_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["trend_detected"]["enabled"] is False


# ---------------------------------------------------------------------------
# PUT /notifications/preferences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_preferences(client: AsyncClient) -> None:
    """PUT /notifications/preferences updates and returns preferences."""
    settings_row = MagicMock()
    settings_row.settings = {}

    with (
        patch(
            "src.identity.routes.notifications.user_repo.get_user_settings",
            new_callable=AsyncMock,
            return_value=settings_row,
        ),
        patch(
            "src.identity.routes.notifications.user_repo.upsert_user_settings",
            new_callable=AsyncMock,
        ) as mock_upsert,
        patch("src.identity.routes.notifications.get_session") as mock_get_session,
    ):
        mock_session = AsyncMock()
        mock_get_session.return_value.__aiter__ = AsyncMock(
            return_value=iter([mock_session])
        )

        resp = await client.put(
            "/notifications/preferences",
            headers=USER_HEADERS,
            json={
                "trend_detected": {"enabled": False, "push": False},
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["trend_detected"]["enabled"] is False
    assert data["trend_detected"]["push"] is False
    mock_upsert.assert_awaited_once()
