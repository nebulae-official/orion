"""Tests for the content reject endpoint (ORION-171)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.auth import CurrentUser, get_current_user
from orion_common.db.session import get_session
from orion_common.events import Channels

from src.routes.content import router

OWNER_ID = str(uuid.uuid4())
OTHER_USER_ID = str(uuid.uuid4())
CONTENT_ID = uuid.uuid4()
TREND_ID = uuid.uuid4()


def _make_content(
    content_id: uuid.UUID = CONTENT_ID,
    created_by: uuid.UUID | None = None,
    trend_id: uuid.UUID = TREND_ID,
) -> SimpleNamespace:
    """Return a lightweight object that behaves like a Content ORM model."""
    return SimpleNamespace(
        id=content_id,
        created_by=created_by if created_by is not None else uuid.UUID(OWNER_ID),
        trend_id=trend_id,
        status="review",
    )


def _make_trend(topic: str = "AI coding assistants") -> SimpleNamespace:
    return SimpleNamespace(id=TREND_ID, topic=topic)


def _owner_user() -> CurrentUser:
    return CurrentUser(user_id=OWNER_ID, role="user", email="owner@test.com")


def _other_user() -> CurrentUser:
    return CurrentUser(user_id=OTHER_USER_ID, role="user", email="other@test.com")


def _admin_user() -> CurrentUser:
    return CurrentUser(user_id=OTHER_USER_ID, role="admin", email="admin@test.com")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    # Default: session.execute returns a result whose scalar_one_or_none gives a trend
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = _make_trend()
    session.execute = AsyncMock(return_value=result_mock)
    session.commit = AsyncMock()
    return session


def _build_app(
    user: CurrentUser,
    session: AsyncMock,
    event_bus: AsyncMock,
) -> FastAPI:
    app = FastAPI(title="Director Test")
    app.include_router(router)
    app.state.event_bus = event_bus

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session
    return app


@pytest_asyncio.fixture
async def owner_client(mock_session: AsyncMock, mock_event_bus: AsyncMock) -> AsyncClient:
    app = _build_app(_owner_user(), mock_session, mock_event_bus)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def other_client(mock_session: AsyncMock, mock_event_bus: AsyncMock) -> AsyncClient:
    app = _build_app(_other_user(), mock_session, mock_event_bus)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def admin_client(mock_session: AsyncMock, mock_event_bus: AsyncMock) -> AsyncClient:
    app = _build_app(_admin_user(), mock_session, mock_event_bus)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reject_content_success(
    owner_client: AsyncClient,
    mock_session: AsyncMock,
) -> None:
    """Owner can reject their own content and gets 200 with status rejected."""
    content = _make_content()

    with patch(
        "src.routes.content.ContentRepository",
    ) as MockRepo:
        repo_instance = MockRepo.return_value
        repo_instance.get_by_id = AsyncMock(return_value=content)
        repo_instance.update_status = AsyncMock(return_value=content)

        resp = await owner_client.post(
            f"/api/v1/content/{CONTENT_ID}/reject",
            json={"reason": "Not relevant enough", "regenerate": False},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    repo_instance.update_status.assert_awaited_once()


@pytest.mark.asyncio
async def test_reject_content_not_found(
    owner_client: AsyncClient,
    mock_session: AsyncMock,
) -> None:
    """Returns 404 when the content ID does not exist."""
    missing_id = uuid.uuid4()

    with patch(
        "src.routes.content.ContentRepository",
    ) as MockRepo:
        repo_instance = MockRepo.return_value
        repo_instance.get_by_id = AsyncMock(return_value=None)

        resp = await owner_client.post(
            f"/api/v1/content/{missing_id}/reject",
            json={"reason": "Does not exist", "regenerate": False},
        )

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reject_content_forbidden(
    other_client: AsyncClient,
    mock_session: AsyncMock,
) -> None:
    """Non-admin, non-owner user receives 403 when rejecting someone else's content."""
    content = _make_content()  # owned by OWNER_ID

    with patch(
        "src.routes.content.ContentRepository",
    ) as MockRepo:
        repo_instance = MockRepo.return_value
        repo_instance.get_by_id = AsyncMock(return_value=content)

        resp = await other_client.post(
            f"/api/v1/content/{CONTENT_ID}/reject",
            json={"reason": "I want to reject this", "regenerate": False},
        )

    assert resp.status_code == 403
    assert "not authorised" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reject_content_admin_allowed(
    admin_client: AsyncClient,
    mock_session: AsyncMock,
) -> None:
    """Admin can reject any content regardless of ownership."""
    content = _make_content()  # owned by OWNER_ID, admin is OTHER_USER_ID

    with patch(
        "src.routes.content.ContentRepository",
    ) as MockRepo:
        repo_instance = MockRepo.return_value
        repo_instance.get_by_id = AsyncMock(return_value=content)
        repo_instance.update_status = AsyncMock(return_value=content)

        resp = await admin_client.post(
            f"/api/v1/content/{CONTENT_ID}/reject",
            json={"reason": "Admin override", "regenerate": False},
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    repo_instance.update_status.assert_awaited_once()


@pytest.mark.asyncio
async def test_reject_content_missing_reason(
    owner_client: AsyncClient,
) -> None:
    """Request with empty or missing reason fails validation (422)."""
    # Missing reason entirely
    resp_missing = await owner_client.post(
        f"/api/v1/content/{CONTENT_ID}/reject",
        json={"regenerate": False},
    )
    assert resp_missing.status_code == 422

    # Empty string reason (min_length=1 constraint)
    resp_empty = await owner_client.post(
        f"/api/v1/content/{CONTENT_ID}/reject",
        json={"reason": "", "regenerate": False},
    )
    assert resp_empty.status_code == 422


@pytest.mark.asyncio
async def test_reject_publishes_event(
    mock_session: AsyncMock,
    mock_event_bus: AsyncMock,
) -> None:
    """Verify that a CONTENT_REJECTED event is published with the correct payload."""
    content = _make_content()
    user = _owner_user()
    app = _build_app(user, mock_session, mock_event_bus)

    with patch(
        "src.routes.content.ContentRepository",
    ) as MockRepo:
        repo_instance = MockRepo.return_value
        repo_instance.get_by_id = AsyncMock(return_value=content)
        repo_instance.update_status = AsyncMock(return_value=content)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/content/{CONTENT_ID}/reject",
                json={"reason": "Off-brand content", "regenerate": True},
            )

    assert resp.status_code == 200

    mock_event_bus.publish.assert_awaited_once_with(
        Channels.CONTENT_REJECTED,
        {
            "content_id": str(CONTENT_ID),
            "feedback": "Off-brand content",
            "trend_topic": "AI coding assistants",
            "niche": "technology",
            "user_id": OWNER_ID,
        },
    )
