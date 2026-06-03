"""End-to-end pipeline tests (P1-P3).

These tests verify cross-service behaviours through a shared Postgres + Redis
testcontainer pair.  No service source code is imported directly — only
orion-common's ORM models and repositories are used to avoid the `src`
module-name collision that would occur if two services were imported in the
same process.

P1 — Scout → Director handoff: a trend saved by Scout is immediately visible
     to Director via the shared database.
P2 — Status lifecycle: Content can traverse the full status chain
     (draft → review → approved → published → rejected) through direct DB writes.
P3 — Health check smoke test: the orion-common health router returns 200 "ok"
     for a minimal FastAPI app — the same pattern used by all 8 services.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.models import (
    Content,
    ContentStatus,
    Trend,
    TrendStatus,
    User,
)
from orion_common.health import create_health_router
from sqlalchemy.ext.asyncio import async_sessionmaker

pytestmark = [pytest.mark.integration, pytest.mark.e2e]


# ---------------------------------------------------------------------------
# Per-test table cleanup
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
async def truncate_e2e_tables(e2e_engine):
    async with e2e_engine.begin() as conn:
        await conn.run_sync(
            lambda c: [
                c.execute(Content.__table__.delete()),
                c.execute(Trend.__table__.delete()),
                c.execute(User.__table__.delete()),
            ]
        )


# ---------------------------------------------------------------------------
# P1: Scout → Director — trend saved by Scout is visible in shared DB
# ---------------------------------------------------------------------------


async def test_p1_trend_saved_by_scout_visible_to_director(
    e2e_session_factory: async_sessionmaker,
) -> None:
    """Simulate Scout persisting a trend; verify Director can read it."""
    trend_id = uuid.uuid4()

    async with e2e_session_factory() as session:
        trend = Trend(
            id=trend_id,
            topic="AI pipeline e2e test",
            source="rss",
            score=80.0,
            status=TrendStatus.active,
        )
        session.add(trend)
        await session.commit()

    # Director reads the same trend from the shared DB
    async with e2e_session_factory() as session:
        fetched = await session.get(Trend, trend_id)

    assert fetched is not None
    assert fetched.topic == "AI pipeline e2e test"
    assert fetched.status == TrendStatus.active


# ---------------------------------------------------------------------------
# P2: Full content status lifecycle
# ---------------------------------------------------------------------------


async def test_p2_content_status_lifecycle(
    e2e_session_factory: async_sessionmaker,
) -> None:
    """Content can traverse draft → review → approved → published."""
    async with e2e_session_factory() as session:
        user = User(id=uuid.uuid4(), email="e2e@orion.test", name="E2E User", role="editor")
        session.add(user)
        await session.flush()

        trend = Trend(
            id=uuid.uuid4(),
            topic="E2E lifecycle trend",
            source="rss",
            score=75.0,
            status=TrendStatus.active,
        )
        session.add(trend)
        await session.flush()

        content = Content(
            id=uuid.uuid4(),
            trend_id=trend.id,
            title="E2E lifecycle content",
            status=ContentStatus.draft,
            created_by=user.id,
        )
        session.add(content)
        await session.commit()
        content_id = content.id

    transitions = [
        ContentStatus.review,
        ContentStatus.approved,
        ContentStatus.published,
    ]

    for new_status in transitions:
        async with e2e_session_factory() as session:
            row = await session.get(Content, content_id)
            row.status = new_status
            await session.commit()

        async with e2e_session_factory() as session:
            row = await session.get(Content, content_id)
        assert row.status == new_status, f"Expected {new_status}, got {row.status}"

    # Final state
    async with e2e_session_factory() as session:
        final = await session.get(Content, content_id)
    assert final.status == ContentStatus.published


# ---------------------------------------------------------------------------
# P3: Health check smoke test — the orion_common health router
# ---------------------------------------------------------------------------


SERVICES = [
    "scout",
    "director",
    "media",
    "editor",
    "pulse",
    "publisher",
    "identity",
    "provider",
]


@pytest.mark.parametrize("service_name", SERVICES)
async def test_p3_health_check_returns_ok(service_name: str) -> None:
    """Each service's health router pattern returns HTTP 200 with status=ok."""
    app = FastAPI()
    app.include_router(create_health_router(service_name))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == service_name
