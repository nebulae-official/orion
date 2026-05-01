"""Integration tests for SystemKeyRepository and admin/internal key routes (ORION-249).

E1-E5: Repository-level DB integration — encrypt/decrypt, None, list, overwrite.
F1-F3: Full HTTP round-trip via FastAPI test client using a real PostgreSQL session.
"""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.identity.repositories.system_key_repository import SystemAPIKey, SystemKeyRepository
from src.identity.routes.admin_keys import router as admin_keys_router
from src.identity.routes.internal_keys import router as internal_keys_router
from src.identity.routes.keys import ALLOWED_PROVIDERS

requires_db = pytest.mark.skipif(
    os.getenv("DATABASE_URL") is None,
    reason="Requires running PostgreSQL (set DATABASE_URL)",
)

pytestmark = [pytest.mark.integration, requires_db]

ADMIN_HEADERS = {"X-User-Role": "admin", "X-User-ID": "test-admin"}


# ---------------------------------------------------------------------------
# E1-E5: SystemKeyRepository DB integration
# ---------------------------------------------------------------------------


async def test_e1_upsert_get_round_trip(db_session: AsyncSession) -> None:
    """E1: upsert + get round trip — decrypted value matches the original plaintext."""
    repo = SystemKeyRepository(db_session)
    await repo.upsert("openai", "sk-secret-value")
    result = await repo.get("openai")
    assert result == "sk-secret-value"


async def test_e2_upsert_encrypts_at_rest(db_session: AsyncSession) -> None:
    """E2: raw DB row stores an encrypted token, not the plaintext key."""
    repo = SystemKeyRepository(db_session)
    await repo.upsert("anthropic", "my-plaintext-key")

    stmt = select(SystemAPIKey).where(SystemAPIKey.provider == "anthropic")
    record = (await db_session.execute(stmt)).scalar_one()
    assert record.encrypted_key != "my-plaintext-key"
    assert len(record.encrypted_key) > 0


async def test_e3_get_returns_none_for_unconfigured(db_session: AsyncSession) -> None:
    """E3: get returns None for a provider that has never been stored."""
    repo = SystemKeyRepository(db_session)
    result = await repo.get("runway")
    assert result is None


async def test_e4_list_providers_reflects_configured_state(db_session: AsyncSession) -> None:
    """E4: list_providers returns True for stored providers and False for all others."""
    repo = SystemKeyRepository(db_session)
    await repo.upsert("openai", "sk-some-key")

    results = await repo.list_providers(ALLOWED_PROVIDERS)
    by_provider = {item["provider"]: item["is_configured"] for item in results}

    assert by_provider["openai"] is True
    for provider in ALLOWED_PROVIDERS:
        if provider != "openai":
            assert by_provider[provider] is False, f"Expected {provider} unconfigured"


async def test_e5_upsert_overwrites_previous_value(db_session: AsyncSession) -> None:
    """E5: a second upsert for the same provider replaces the first value."""
    repo = SystemKeyRepository(db_session)
    await repo.upsert("groq", "first-value")
    await repo.upsert("groq", "second-value")

    result = await repo.get("groq")
    assert result == "second-value"


# ---------------------------------------------------------------------------
# F1-F3: Full app HTTP integration
# ---------------------------------------------------------------------------


def _make_app(session: AsyncSession) -> FastAPI:
    """Minimal FastAPI app with both key routers wired to a real DB session."""
    app = FastAPI(title="System Keys Integration Test")
    app.include_router(admin_keys_router)
    app.include_router(internal_keys_router)

    async def _override_get_session():
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    return app


async def test_f1_put_admin_then_get_internal_round_trip(db_session: AsyncSession) -> None:
    """F1: PUT admin key then GET internal key — value survives the full HTTP round-trip."""
    app = _make_app(db_session)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        put_resp = await client.put(
            "/api/v1/admin/keys/openai",
            json={"key": "sk-integration-test"},
            headers=ADMIN_HEADERS,
        )
        assert put_resp.status_code == 200

        get_resp = await client.get("/api/v1/internal/system-keys/openai")
        assert get_resp.status_code == 200
        assert get_resp.json()["key"] == "sk-integration-test"


async def test_f2_put_then_list_shows_configured_no_secret(db_session: AsyncSession) -> None:
    """F2: after PUT, admin list shows is_configured=True with no key value in response."""
    app = _make_app(db_session)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.put(
            "/api/v1/admin/keys/anthropic",
            json={"key": "sk-ant-test"},
            headers=ADMIN_HEADERS,
        )

        list_resp = await client.get("/api/v1/admin/keys", headers=ADMIN_HEADERS)
        assert list_resp.status_code == 200

        by_provider = {item["provider"]: item for item in list_resp.json()["keys"]}
        assert by_provider["anthropic"]["is_configured"] is True
        assert "key" not in by_provider["anthropic"]
        assert "encrypted_key" not in by_provider["anthropic"]


async def test_f3_get_internal_unconfigured_returns_404(db_session: AsyncSession) -> None:
    """F3: GET /api/v1/internal/system-keys/{provider} returns 404 when no key stored."""
    app = _make_app(db_session)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/internal/system-keys/runway")
        assert resp.status_code == 404
