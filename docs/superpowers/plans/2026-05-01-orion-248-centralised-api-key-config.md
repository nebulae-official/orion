# ORION-248: Centralised API Key Configuration Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `os.getenv("NVIDIA_API_KEY")` in the Provider Service with a two-tier key resolver (per-user → system/admin store), and add a dashboard admin UI for managing system-level provider keys without restarting services.

**Architecture:** Identity Service gains a `system_api_keys` table for admin-managed provider keys, exposed via `/api/v1/admin/keys` (dashboard→gateway→identity) and `/api/v1/internal/system-keys/{provider}` (provider service→identity). Provider Service's `KeyResolver` fetches per-user key first, falls back to the 5-min TTL cached system key, and raises 503 if neither resolves — never reads from env.

**Tech Stack:** Python 3.13, FastAPI 0.115, SQLAlchemy 2.0 async, Pydantic v2, Alembic (shared migrations), httpx, cryptography (Fernet), Next.js 15 (Server Actions), TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `migrations/versions/015_add_system_api_keys_table.py` | DB schema for admin key store |
| Create | `services/identity/src/identity/repositories/system_key_repository.py` | Encrypted CRUD for system_api_keys |
| Create | `services/identity/src/identity/routes/admin_keys.py` | Admin CRUD endpoints (role-gated) |
| Create | `services/identity/src/identity/routes/internal_keys.py` | Internal fetch endpoint for Provider Service |
| Modify | `services/identity/src/identity/main.py` | Wire new routers |
| Create | `services/identity/tests/test_admin_key_routes.py` | Tests for admin key routes |
| Create | `services/identity/tests/test_internal_key_routes.py` | Tests for internal key route |
| Modify | `libs/orion-common/orion_common/identity_client.py` | Add `get_system_api_key()` |
| Create | `services/provider/src/key_resolver.py` | Two-tier KeyResolver + KeyUnavailableError |
| Modify | `services/provider/src/main.py` | Instantiate KeyResolver in lifespan |
| Modify | `services/provider/src/routes/llm.py` | Use key_resolver, remove env var |
| Modify | `services/provider/src/routes/image.py` | Use key_resolver, remove env var |
| Modify | `services/provider/src/routes/tts.py` | Use key_resolver, remove env var |
| Create | `services/provider/tests/test_key_resolver.py` | Unit tests for KeyResolver |
| Create | `dashboard/src/app/(dashboard)/settings/admin-keys/page.tsx` | Admin API Keys management page |
| Modify | `dashboard/src/lib/actions.ts` | Add admin key server actions |
| Modify | `dashboard/src/components/sidebar.tsx` | Add "API Keys" admin nav link |
| Modify | `.env.example` | Remove NVIDIA_API_KEY, add guidance comment |

---

## Task 1: DB Migration — system_api_keys table

**Files:**
- Create: `migrations/versions/015_add_system_api_keys_table.py`

- [ ] **Step 1: Write the migration**

```python
# migrations/versions/015_add_system_api_keys_table.py
"""Add system_api_keys table for admin-managed provider API keys.

Revision ID: 015
Revises: 014
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "015"
down_revision = "014"


def upgrade() -> None:
    op.create_table(
        "system_api_keys",
        sa.Column("provider", sa.String(64), primary_key=True),
        sa.Column("encrypted_key", sa.Text, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("system_api_keys")
```

- [ ] **Step 2: Verify the migration runs**

```bash
cd /home/gishantsingh/dev/projects/orion
uv run alembic -c migrations/alembic.ini upgrade head
```

Expected: No errors, `system_api_keys` table created.

- [ ] **Step 3: Verify downgrade works**

```bash
uv run alembic -c migrations/alembic.ini downgrade -1
uv run alembic -c migrations/alembic.ini upgrade head
```

Expected: Clean round-trip.

- [ ] **Step 4: Commit**

```bash
git add migrations/versions/015_add_system_api_keys_table.py
git commit -m "feat(ORION-248): add system_api_keys migration"
```

---

## Task 2: SystemKeyRepository — Identity service

**Files:**
- Create: `services/identity/src/identity/repositories/system_key_repository.py`

- [ ] **Step 1: Write the repository**

```python
# services/identity/src/identity/repositories/system_key_repository.py
"""Repository for system_api_keys — admin-managed encrypted provider API keys."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from orion_common.db import Base
from sqlalchemy import DateTime, String, Text, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from ..encryption import decrypt, encrypt

logger = structlog.get_logger(__name__)


class SystemAPIKey(Base):
    """Stores an encrypted system-level API key for a provider (admin-managed)."""

    __tablename__ = "system_api_keys"

    provider: Mapped[str] = mapped_column(String(64), primary_key=True)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class SystemKeyRepository:
    """CRUD operations for encrypted system API keys."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, provider: str) -> str | None:
        """Return the decrypted system key for *provider*, or ``None``."""
        stmt = select(SystemAPIKey).where(SystemAPIKey.provider == provider)
        record = (await self._session.execute(stmt)).scalar_one_or_none()
        if record is None:
            return None
        return decrypt(record.encrypted_key)

    async def upsert(self, provider: str, key: str) -> None:
        """Store (or replace) an encrypted system key for *provider*."""
        now = datetime.now(UTC)
        stmt = (
            insert(SystemAPIKey)
            .values(provider=provider, encrypted_key=encrypt(key), updated_at=now)
            .on_conflict_do_update(
                index_elements=["provider"],
                set_={"encrypted_key": encrypt(key), "updated_at": now},
            )
        )
        await self._session.execute(stmt)
        await self._session.commit()
        await logger.ainfo("system_api_key_stored", provider=provider)

    async def list_providers(self, all_providers: frozenset[str]) -> list[dict[str, Any]]:
        """Return [{provider, is_configured}] for every provider in *all_providers*."""
        stmt = select(SystemAPIKey.provider)
        configured = {
            row.provider
            for row in (await self._session.execute(stmt)).all()
        }
        return [
            {"provider": p, "is_configured": p in configured}
            for p in sorted(all_providers)
        ]
```

- [ ] **Step 2: Commit**

```bash
git add services/identity/src/identity/repositories/system_key_repository.py
git commit -m "feat(ORION-248): add SystemKeyRepository for admin-managed keys"
```

---

## Task 3: Admin keys routes — Identity service

**Files:**
- Create: `services/identity/src/identity/routes/admin_keys.py`
- Create: `services/identity/tests/test_admin_key_routes.py`

The gateway strips the service-name segment from proxied paths, so:
`/api/v1/identity/admin/keys` → identity receives `/api/v1/admin/keys`.
No gateway changes are needed.

- [ ] **Step 1: Write the failing tests**

```python
# services/identity/tests/test_admin_key_routes.py
"""Tests for admin system API key management routes (ORION-248)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.admin_keys import router as admin_keys_router

ADMIN_HEADERS = {
    "X-User-ID": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "X-User-Role": "admin",
    "X-User-Email": "admin@example.com",
}

EDITOR_HEADERS = {
    "X-User-ID": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "X-User-Role": "editor",
    "X-User-Email": "editor@example.com",
}


@pytest.fixture
def mock_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def admin_app(mock_repo: AsyncMock) -> FastAPI:
    app = FastAPI(title="Admin Keys Test")
    app.include_router(admin_keys_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(admin_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=admin_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_admin_keys_as_admin(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/admin/keys returns provider status list for admins."""
    mock_repo.list_providers.return_value = [
        {"provider": "nvidia_nim", "is_configured": True},
    ]

    with patch(
        "src.identity.routes.admin_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/admin/keys", headers=ADMIN_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert "keys" in data
    # Never exposes raw key values
    for item in data["keys"]:
        assert "encrypted_key" not in item
        assert "api_key" not in item


@pytest.mark.asyncio
async def test_list_admin_keys_forbidden_for_editor(client: AsyncClient) -> None:
    """GET /api/v1/admin/keys returns 403 for non-admin users."""
    resp = await client.get("/api/v1/admin/keys", headers=EDITOR_HEADERS)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_upsert_admin_key_as_admin(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """PUT /api/v1/admin/keys/{provider} stores a key for admins."""
    with patch(
        "src.identity.routes.admin_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.put(
            "/api/v1/admin/keys/nvidia_nim",
            json={"key": "nvapi-secret"},
            headers=ADMIN_HEADERS,
        )

    assert resp.status_code == 200
    mock_repo.upsert.assert_awaited_once_with("nvidia_nim", "nvapi-secret")


@pytest.mark.asyncio
async def test_upsert_admin_key_invalid_provider(client: AsyncClient) -> None:
    """PUT with unknown provider returns 400."""
    resp = await client.put(
        "/api/v1/admin/keys/unknown_provider",
        json={"key": "some-key"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upsert_admin_key_forbidden_for_editor(client: AsyncClient) -> None:
    """PUT /api/v1/admin/keys/{provider} returns 403 for non-admin users."""
    resp = await client.put(
        "/api/v1/admin/keys/nvidia_nim",
        json={"key": "nvapi-secret"},
        headers=EDITOR_HEADERS,
    )
    assert resp.status_code == 403
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run pytest tests/test_admin_key_routes.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` (route doesn't exist yet).

- [ ] **Step 3: Write the route**

```python
# services/identity/src/identity/routes/admin_keys.py
"""Admin routes for system-level (org-wide) provider API key management."""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from orion_common.db.session import get_session
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.system_key_repository import SystemKeyRepository
from .keys import ALLOWED_PROVIDERS

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/admin/keys", tags=["admin-keys"])


def _require_admin(request: Request) -> None:
    """Raise 403 if caller is not an admin (role injected by gateway)."""
    role = request.headers.get("X-User-Role", "viewer")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


class UpsertSystemKeyRequest(BaseModel):
    key: str = Field(..., min_length=1, description="The raw API key to encrypt and store")


class SystemKeyStatus(BaseModel):
    provider: str
    is_configured: bool


class SystemKeyListResponse(BaseModel):
    keys: list[SystemKeyStatus]


class MessageResponse(BaseModel):
    message: str


@router.get("", response_model=SystemKeyListResponse)
async def list_system_keys(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SystemKeyListResponse:
    """Return configuration status for all allowed providers (admin only).

    Never returns raw key values — only whether each provider has a key stored.
    """
    _require_admin(request)
    repo = SystemKeyRepository(session)
    items = await repo.list_providers(ALLOWED_PROVIDERS)
    return SystemKeyListResponse(keys=[SystemKeyStatus(**i) for i in items])


@router.put("/{provider}", response_model=MessageResponse)
async def upsert_system_key(
    provider: str,
    body: UpsertSystemKeyRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageResponse:
    """Store or replace the system-level API key for a provider (admin only)."""
    _require_admin(request)
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    repo = SystemKeyRepository(session)
    await repo.upsert(provider, body.key)
    await logger.ainfo("system_key_upserted", provider=provider)
    return MessageResponse(message=f"System API key for {provider} stored successfully")
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run pytest tests/test_admin_key_routes.py -v
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/identity/src/identity/routes/admin_keys.py services/identity/tests/test_admin_key_routes.py
git commit -m "feat(ORION-248): add admin system key routes and tests"
```

---

## Task 4: Internal key route — Identity service

**Files:**
- Create: `services/identity/src/identity/routes/internal_keys.py`
- Create: `services/identity/tests/test_internal_key_routes.py`

This endpoint is called by the Provider Service (not the dashboard).
The `InternalAuthMiddleware` on the Identity app already validates `X-Internal-Token`.

- [ ] **Step 1: Write the failing tests**

```python
# services/identity/tests/test_internal_key_routes.py
"""Tests for internal system key fetch route (ORION-248)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from orion_common.db.session import get_session
from src.identity.routes.internal_keys import router as internal_keys_router


@pytest.fixture
def mock_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def internal_app(mock_repo: AsyncMock) -> FastAPI:
    app = FastAPI(title="Internal Keys Test")
    app.include_router(internal_keys_router)

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session
    return app


@pytest_asyncio.fixture
async def client(internal_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=internal_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_get_system_key_found(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/internal/system-keys/{provider} returns key when configured."""
    mock_repo.get.return_value = "nvapi-decrypted-secret"

    with patch(
        "src.identity.routes.internal_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/internal/system-keys/nvidia_nim")

    assert resp.status_code == 200
    data = resp.json()
    assert data["key"] == "nvapi-decrypted-secret"
    mock_repo.get.assert_awaited_once_with("nvidia_nim")


@pytest.mark.asyncio
async def test_get_system_key_not_found(client: AsyncClient, mock_repo: AsyncMock) -> None:
    """GET /api/v1/internal/system-keys/{provider} returns 404 when not configured."""
    mock_repo.get.return_value = None

    with patch(
        "src.identity.routes.internal_keys.SystemKeyRepository",
        return_value=mock_repo,
    ):
        resp = await client.get("/api/v1/internal/system-keys/nvidia_nim")

    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run pytest tests/test_internal_key_routes.py -v
```

Expected: ImportError (route doesn't exist yet).

- [ ] **Step 3: Write the route**

```python
# services/identity/src/identity/routes/internal_keys.py
"""Internal routes for service-to-service system key fetching."""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException
from orion_common.db.session import get_session
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.system_key_repository import SystemKeyRepository

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


class SystemKeyResponse(BaseModel):
    key: str


@router.get("/system-keys/{provider}", response_model=SystemKeyResponse)
async def get_system_key(
    provider: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SystemKeyResponse:
    """Return the decrypted system key for *provider*.

    Called by Provider Service, not the dashboard. The InternalAuthMiddleware
    on the app validates X-Internal-Token before this handler runs.
    """
    repo = SystemKeyRepository(session)
    key = await repo.get(provider)
    if key is None:
        raise HTTPException(status_code=404, detail=f"No system key configured for: {provider}")
    return SystemKeyResponse(key=key)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run pytest tests/test_internal_key_routes.py -v
```

Expected: Both tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/identity/src/identity/routes/internal_keys.py services/identity/tests/test_internal_key_routes.py
git commit -m "feat(ORION-248): add internal system key fetch route and tests"
```

---

## Task 5: Wire new routes into Identity main.py

**Files:**
- Modify: `services/identity/src/identity/main.py`

- [ ] **Step 1: Add imports and include_router calls**

In `services/identity/src/identity/main.py`, add two imports after the existing route imports:

```python
from .routes.admin_keys import router as admin_keys_router
from .routes.internal_keys import router as internal_keys_router
```

Then add two `include_router` calls after `app.include_router(providers_router)`:

```python
app.include_router(admin_keys_router)
app.include_router(internal_keys_router)
```

Full updated tail of the file (lines after `app.include_router(providers_router)`):

```python
app.include_router(admin_keys_router)
app.include_router(internal_keys_router)
```

- [ ] **Step 2: Verify the app starts without import errors**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run python -c "from src.identity.main import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Verify routes are registered**

```bash
uv run python -c "
from src.identity.main import app
routes = [r.path for r in app.routes]
assert any('/admin/keys' in r for r in routes), f'admin/keys not found in {routes}'
assert any('/internal/system-keys' in r for r in routes), f'internal route not found in {routes}'
print('All routes registered OK')
"
```

Expected: `All routes registered OK`

- [ ] **Step 4: Run full identity test suite**

```bash
cd /home/gishantsingh/dev/projects/orion/services/identity
uv run pytest tests/ -v --tb=short
```

Expected: All existing tests pass plus the 7 new tests (Tasks 3 and 4).

- [ ] **Step 5: Commit**

```bash
git add services/identity/src/identity/main.py
git commit -m "feat(ORION-248): wire admin_keys and internal_keys routers into identity main"
```

---

## Task 6: IdentityClient — add get_system_api_key()

**Files:**
- Modify: `libs/orion-common/orion_common/identity_client.py`

- [ ] **Step 1: Add the method to IdentityClient**

After the existing `get_api_key` method (line 78 in the current file), add:

```python
    async def get_system_api_key(self, provider: str) -> str | None:
        """Return the decrypted system-level API key for *provider*, or ``None``.

        Returns ``None`` when:
        - no admin has configured a key for that provider, or
        - the Identity service is unreachable (degrades gracefully).
        """
        url = f"{self._base_url}/api/v1/internal/system-keys/{provider}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers)

            if resp.status_code == 404:
                return None

            resp.raise_for_status()
            data = resp.json()
            return data.get("key")  # type: ignore[return-value]

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "identity_system_key_fetch_http_error",
                provider=provider,
                status=exc.response.status_code,
            )
            return None
        except Exception:  # Identity service down — treat as not configured
            logger.warning("identity_system_key_fetch_failed", provider=provider)
            return None
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /home/gishantsingh/dev/projects/orion/libs/orion-common
uv run python -c "from orion_common.identity_client import IdentityClient; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Run orion-common tests if any exist**

```bash
cd /home/gishantsingh/dev/projects/orion/libs/orion-common
uv run pytest tests/ -v --tb=short 2>/dev/null || echo "No tests in orion-common"
```

- [ ] **Step 4: Commit**

```bash
git add libs/orion-common/orion_common/identity_client.py
git commit -m "feat(ORION-248): add get_system_api_key() to IdentityClient"
```

---

## Task 7: KeyResolver — Provider Service

**Files:**
- Create: `services/provider/src/key_resolver.py`
- Create: `services/provider/tests/__init__.py`
- Create: `services/provider/tests/test_key_resolver.py`

- [ ] **Step 1: Write the failing tests**

```python
# services/provider/tests/test_key_resolver.py
"""Unit tests for KeyResolver (ORION-248)."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import pytest

from src.key_resolver import KeyResolver, KeyUnavailableError


@pytest.fixture
def mock_identity() -> AsyncMock:
    client = AsyncMock()
    client.get_api_key = AsyncMock(return_value=None)
    client.get_system_api_key = AsyncMock(return_value=None)
    return client


@pytest.mark.asyncio
async def test_resolves_per_user_key(mock_identity: AsyncMock) -> None:
    """Per-user key takes priority when user_id is provided."""
    mock_identity.get_api_key.return_value = "user-key-abc"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve("user-123")

    assert key == "user-key-abc"
    mock_identity.get_api_key.assert_awaited_once_with(user_id="user-123", provider="nvidia_nim")
    mock_identity.get_system_api_key.assert_not_awaited()


@pytest.mark.asyncio
async def test_falls_back_to_system_key_when_no_user_key(mock_identity: AsyncMock) -> None:
    """Falls back to system key when per-user key is absent."""
    mock_identity.get_api_key.return_value = None
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve("user-123")

    assert key == "system-key-xyz"


@pytest.mark.asyncio
async def test_uses_system_key_when_no_user_id(mock_identity: AsyncMock) -> None:
    """Uses system key directly when no user_id is provided."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key = await resolver.resolve(None)

    assert key == "system-key-xyz"
    mock_identity.get_api_key.assert_not_awaited()


@pytest.mark.asyncio
async def test_raises_when_no_key_available(mock_identity: AsyncMock) -> None:
    """Raises KeyUnavailableError when neither tier has a key."""
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    with pytest.raises(KeyUnavailableError):
        await resolver.resolve("user-123")


@pytest.mark.asyncio
async def test_system_key_cached_for_5_minutes(mock_identity: AsyncMock) -> None:
    """System key is fetched once and cached for 5 minutes."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    key1 = await resolver.resolve(None)
    key2 = await resolver.resolve(None)

    assert key1 == key2 == "system-key-xyz"
    mock_identity.get_system_api_key.assert_awaited_once()


@pytest.mark.asyncio
async def test_system_key_cache_expires(mock_identity: AsyncMock) -> None:
    """Cache is bypassed when TTL has expired."""
    mock_identity.get_system_api_key.return_value = "system-key-xyz"
    resolver = KeyResolver(mock_identity, provider="nvidia_nim")

    await resolver.resolve(None)
    # Manually expire the cache
    resolver._cache_expires_at = time.monotonic() - 1

    await resolver.resolve(None)
    assert mock_identity.get_system_api_key.await_count == 2
```

- [ ] **Step 2: Create test package init**

```bash
mkdir -p /home/gishantsingh/dev/projects/orion/services/provider/tests
touch /home/gishantsingh/dev/projects/orion/services/provider/tests/__init__.py
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /home/gishantsingh/dev/projects/orion/services/provider
uv run pytest tests/test_key_resolver.py -v
```

Expected: `ImportError` (module doesn't exist yet).

- [ ] **Step 4: Write KeyResolver**

```python
# services/provider/src/key_resolver.py
"""Two-tier API key resolver for the Provider Service.

Resolution order:
  1. Per-user key  — from Identity service, keyed by X-User-ID
  2. System key    — admin-configured in Identity, TTL-cached 5 minutes
  3. KeyUnavailableError — raises 503 at the route layer
"""

from __future__ import annotations

import time

import structlog
from orion_common.identity_client import IdentityClient

logger = structlog.get_logger(__name__)

_SYSTEM_KEY_TTL = 300.0  # 5 minutes


class KeyUnavailableError(Exception):
    """Raised when no API key is available for the requested provider."""


class KeyResolver:
    """Resolves provider API keys with a two-tier fallback strategy."""

    def __init__(self, identity_client: IdentityClient, provider: str = "nvidia_nim") -> None:
        self._identity_client = identity_client
        self._provider = provider
        self._system_key_cache: str | None = None
        self._cache_expires_at: float = 0.0

    async def resolve(self, user_id: str | None) -> str:
        """Return an API key or raise KeyUnavailableError.

        Tries per-user key first (when user_id is present), then falls back
        to the cached system key. Never reads from environment variables.
        """
        if user_id:
            user_key = await self._identity_client.get_api_key(
                user_id=user_id, provider=self._provider
            )
            if user_key:
                await logger.ainfo("key_resolved_per_user", provider=self._provider)
                return user_key

        if self._system_key_cache and time.monotonic() < self._cache_expires_at:
            return self._system_key_cache

        system_key = await self._identity_client.get_system_api_key(self._provider)
        if system_key:
            self._system_key_cache = system_key
            self._cache_expires_at = time.monotonic() + _SYSTEM_KEY_TTL
            await logger.ainfo("key_resolved_system", provider=self._provider)
            return system_key

        raise KeyUnavailableError(
            f"No API key configured for provider '{self._provider}'. "
            "Set a system key via Admin → API Keys or configure a per-user key."
        )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/gishantsingh/dev/projects/orion/services/provider
uv run pytest tests/test_key_resolver.py -v
```

Expected: All 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add services/provider/src/key_resolver.py services/provider/tests/__init__.py services/provider/tests/test_key_resolver.py
git commit -m "feat(ORION-248): add KeyResolver with two-tier key resolution and tests"
```

---

## Task 8: Wire KeyResolver into Provider Service main.py

**Files:**
- Modify: `services/provider/src/main.py`

- [ ] **Step 1: Update main.py**

Replace the entire file content with:

```python
# services/provider/src/main.py
"""Orion Provider Service — centralized AI gateway for LLM and media providers."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from orion_common.config import get_settings
from orion_common.health import create_health_router
from orion_common.identity_client import IdentityClient
from orion_common.logging import configure_logging
from orion_common.middleware import InternalAuthMiddleware

from src.key_resolver import KeyResolver
from src.routes.image import router as image_router
from src.routes.llm import router as llm_router
from src.routes.tts import router as tts_router

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    identity_client = IdentityClient(
        base_url=settings.identity_url,
        internal_token=settings.internal_token,
    )
    app.state.key_resolver = KeyResolver(
        identity_client=identity_client,
        provider="nvidia_nim",
    )
    logger.info("service_starting", service="provider")
    yield
    logger.info("service_stopping", service="provider")


app = FastAPI(title="Orion Provider Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(InternalAuthMiddleware, token=settings.internal_token)

health_router = create_health_router("provider")
app.include_router(health_router)
app.include_router(llm_router)
app.include_router(image_router)
app.include_router(tts_router)
```

- [ ] **Step 2: Verify app loads**

```bash
cd /home/gishantsingh/dev/projects/orion/services/provider
uv run python -c "from src.main import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add services/provider/src/main.py
git commit -m "feat(ORION-248): instantiate KeyResolver in provider lifespan, remove module-level env reads"
```

---

## Task 9: Refactor Provider routes — llm.py, image.py, tts.py

**Files:**
- Modify: `services/provider/src/routes/llm.py`
- Modify: `services/provider/src/routes/image.py`
- Modify: `services/provider/src/routes/tts.py`

- [ ] **Step 1: Update llm.py**

Replace the file with:

```python
# services/provider/src/routes/llm.py
from __future__ import annotations

import os

import litellm
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import LLMCompleteRequest, LLMCompleteResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

_LLM_MODEL = os.getenv("PROVIDER_LLM_MODEL", "meta/llama-3.3-70b-instruct")
_LLM_BASE_URL = os.getenv("PROVIDER_LLM_BASE_URL", "https://integrate.api.nvidia.com/v1")


@router.post("/complete", response_model=LLMCompleteResponse)
async def complete(body: LLMCompleteRequest, request: Request) -> LLMCompleteResponse:
    model = body.model or _LLM_MODEL
    messages: list[dict] = []
    if body.system_prompt is not None:
        messages.append({"role": "system", "content": body.system_prompt})
    messages.append({"role": "user", "content": body.prompt})

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    try:
        response = await litellm.acompletion(
            model=f"nvidia_nim/{model}",
            messages=messages,
            api_key=api_key,
            api_base=_LLM_BASE_URL,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
    except Exception as exc:  # litellm raises heterogeneous exception types
        logger.error("llm_completion_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="LLM provider error") from exc

    content: str = response.choices[0].message.content
    usage = dict(response.usage) if response.usage else None

    logger.info("llm_completion_ok", model=response.model, usage=usage)

    return LLMCompleteResponse(content=content, model=response.model, usage=usage)
```

- [ ] **Step 2: Update image.py**

Replace the file with:

```python
# services/provider/src/routes/image.py
from __future__ import annotations

import os

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import ImageGenerateRequest, ImageGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/image", tags=["image"])

_IMAGE_MODEL = os.getenv("PROVIDER_IMAGE_MODEL", "black-forest-labs/flux.1-schnell")
_IMAGE_BASE_URL = os.getenv("PROVIDER_IMAGE_BASE_URL", "https://ai.api.nvidia.com/v1/genai")


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate_image(body: ImageGenerateRequest, request: Request) -> ImageGenerateResponse:
    model = body.model or _IMAGE_MODEL
    url = f"{_IMAGE_BASE_URL}/{model}"

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload: dict = {
        "prompt": body.prompt,
        "width": body.width,
        "height": body.height,
        "num_inference_steps": body.steps,
    }
    if body.negative_prompt is not None:
        payload["negative_prompt"] = body.negative_prompt
    if body.seed is not None:
        payload["seed"] = body.seed

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("nvidia_image_api_error", status=exc.response.status_code, model=model)
        raise HTTPException(status_code=502, detail="Image provider error") from exc
    except Exception as exc:  # network errors, timeouts, etc.
        logger.error("nvidia_image_request_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="Image provider error") from exc

    artifacts = data.get("artifacts", [])
    if not artifacts:
        logger.error("nvidia_image_no_artifacts", model=model, response=data)
        raise HTTPException(status_code=502, detail="Image provider returned no artifacts")

    artifact = artifacts[0]
    image_b64: str = artifact["base64"]
    seed: int | None = artifact.get("seed")

    logger.info("image_generated", model=model, width=body.width, height=body.height)

    return ImageGenerateResponse(
        image_b64=image_b64,
        provider=f"nvidia_nim/{model}",
        width=body.width,
        height=body.height,
        seed=seed,
    )
```

- [ ] **Step 3: Update tts.py**

Replace the file with:

```python
# services/provider/src/routes/tts.py
from __future__ import annotations

import base64
import os

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request

from src.key_resolver import KeyResolver, KeyUnavailableError
from src.schemas import TTSGenerateRequest, TTSGenerateResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])

_TTS_MODEL = os.getenv("PROVIDER_TTS_MODEL", "nvidia/magpie-tts-multilingual")
_TTS_BASE_URL = "https://integrate.api.nvidia.com/v1/audio/speech"


@router.post("/speak", response_model=TTSGenerateResponse)
async def speak(body: TTSGenerateRequest, request: Request) -> TTSGenerateResponse:
    model = body.model or _TTS_MODEL

    key_resolver: KeyResolver = request.app.state.key_resolver
    try:
        api_key = await key_resolver.resolve(request.headers.get("X-User-ID"))
    except KeyUnavailableError:
        raise HTTPException(status_code=503, detail="No API key configured for this provider")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "input": body.text,
        "voice": body.voice,
        "response_format": body.response_format,
        "speed": body.speed,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(_TTS_BASE_URL, json=payload, headers=headers)
            resp.raise_for_status()
            audio_bytes = resp.content
    except httpx.HTTPStatusError as exc:
        logger.error("nvidia_tts_api_error", status=exc.response.status_code, model=model)
        raise HTTPException(status_code=502, detail="TTS provider error") from exc
    except Exception as exc:  # network errors, timeouts, etc.
        logger.error("nvidia_tts_request_failed", model=model, error=str(exc))
        raise HTTPException(status_code=502, detail="TTS provider error") from exc

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    logger.info("tts_synthesized", model=model, format=body.response_format, bytes=len(audio_bytes))

    return TTSGenerateResponse(
        audio_b64=audio_b64,
        provider=f"nvidia_nim/{model}",
        format=body.response_format,
    )
```

- [ ] **Step 4: Verify no NVIDIA_API_KEY references remain**

```bash
grep -r "NVIDIA_API_KEY" /home/gishantsingh/dev/projects/orion/services/provider/
```

Expected: No output (zero matches).

- [ ] **Step 5: Run provider tests**

```bash
cd /home/gishantsingh/dev/projects/orion/services/provider
uv run pytest tests/ -v --tb=short
```

Expected: All tests pass (including KeyResolver tests from Task 7).

- [ ] **Step 6: Commit**

```bash
git add services/provider/src/routes/llm.py services/provider/src/routes/image.py services/provider/src/routes/tts.py
git commit -m "feat(ORION-248): replace env-var API key with KeyResolver in all provider routes"
```

---

## Task 10: Dashboard — Admin server actions

**Files:**
- Modify: `dashboard/src/lib/actions.ts`

These Server Actions are called by the admin API keys page. They call
`/api/v1/identity/admin/keys`, which the gateway proxy rewrites to
`/api/v1/admin/keys` on the identity service.

- [ ] **Step 1: Add admin key server actions to actions.ts**

At the end of `dashboard/src/lib/actions.ts`, append:

```typescript
// ---------------------------------------------------------------------------
// Admin system key management (admin users only)
// ---------------------------------------------------------------------------

export interface SystemKeyStatus {
  provider: string;
  is_configured: boolean;
}

/**
 * List all providers and their system key configuration status.
 * Admin only — non-admins receive 403 from Identity.
 */
export async function listSystemKeys(): Promise<SystemKeyStatus[]> {
  try {
    const response = await authenticatedFetch("/api/v1/identity/admin/keys");
    if (!response.ok) return [];
    const data = await response.json() as { keys: SystemKeyStatus[] };
    return data.keys ?? [];
  } catch {
    return [];
  }
}

/**
 * Store or replace a system-level API key for a provider.
 * Admin only. Key is sent over TLS and encrypted at rest in Identity.
 */
export async function saveSystemKey(
  provider: string,
  key: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      `/api/v1/identity/admin/keys/${provider}`,
      {
        method: "PUT",
        body: JSON.stringify({ key }),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Save failed" }));
      return { success: false, error: body.detail ?? body.message ?? "Failed to save system key" };
    }

    revalidatePath("/settings/admin-keys");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gishantsingh/dev/projects/orion/dashboard
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/actions.ts
git commit -m "feat(ORION-248): add admin system key server actions to dashboard"
```

---

## Task 11: Dashboard — Admin API Keys page

**Files:**
- Create: `dashboard/src/app/(dashboard)/settings/admin-keys/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// dashboard/src/app/(dashboard)/settings/admin-keys/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { listSystemKeys, saveSystemKey, type SystemKeyStatus } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Modal for entering a new key
// ---------------------------------------------------------------------------

function UpdateKeyModal({
  provider,
  onClose,
  onSave,
}: {
  provider: string;
  onClose: () => void;
  onSave: (provider: string, key: string) => Promise<void>;
}): React.ReactElement {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(provider, value.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">
          Set system key for <span className="text-primary">{provider}</span>
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          This key is shared across all users. It will be encrypted before storage.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste API key"
          className="mb-4 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!value.trim() || saving}
            className="flex-1"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Key"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ConfiguredBadge({ configured }: { configured: boolean }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        configured ? "bg-success-surface text-success-light" : "bg-surface-elevated text-text-dim",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          configured ? "bg-success" : "bg-text-dim",
        )}
      />
      {configured ? "Configured" : "Not set"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminApiKeysPage(): React.ReactElement {
  const [keys, setKeys] = useState<SystemKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    listSystemKeys().then((data) => {
      setKeys(data);
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (provider: string, key: string) => {
    const result = await saveSystemKey(provider, key);
    setEditingProvider(null);
    if (result.success) {
      setKeys((prev) =>
        prev.map((k) => (k.provider === provider ? { ...k, is_configured: true } : k)),
      );
      setMessage({ type: "success", text: `System key for ${provider} saved.` });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to save key." });
    }
    setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <KeyRound className="h-8 w-8 text-text-secondary" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Admin API Keys
            </h1>
            <p className="mt-1 text-text-secondary">
              System-level provider keys shared across all users. Rotatable without restarting services.
            </p>
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-success/30 bg-success-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium text-success-light">Encrypted Storage</p>
          <p className="mt-1 text-xs text-success-light/80">
            Keys are encrypted with Fernet AES-128 before storage. Raw keys are never logged or
            returned by any API. Per-user keys (set in Settings → API Keys) take priority over these
            system defaults.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-success/30 bg-success-surface text-success-light"
              : "border-danger/30 bg-danger-surface text-danger-light",
          )}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-elevated">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">Provider</th>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">Status</th>
                <th className="px-6 py-3 text-right font-medium text-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((entry) => (
                <tr key={entry.provider} className="bg-surface hover:bg-surface-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-text">{entry.provider}</td>
                  <td className="px-6 py-4">
                    <ConfiguredBadge configured={entry.is_configured} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant={entry.is_configured ? "outline" : "default"}
                      onClick={() => setEditingProvider(entry.provider)}
                    >
                      {entry.is_configured ? "Update" : "Set Key"}
                    </Button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-text-muted">
                    No providers found. Ensure the Identity service is running.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingProvider && (
        <UpdateKeyModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gishantsingh/dev/projects/orion/dashboard
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/\(dashboard\)/settings/admin-keys/page.tsx
git commit -m "feat(ORION-248): add Admin API Keys dashboard page"
```

---

## Task 12: Dashboard — Add Admin nav link

**Files:**
- Modify: `dashboard/src/components/sidebar.tsx`

The sidebar already has an `ADMIN_NAV_ITEMS` array and renders it when `isAdmin` is true (line 40-42, 159-175). Add "API Keys" to that array.

- [ ] **Step 1: Update ADMIN_NAV_ITEMS in sidebar.tsx**

In `dashboard/src/components/sidebar.tsx`, find this block (around line 40):

```typescript
const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
];
```

Replace it with:

```typescript
const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
  { label: "API Keys", href: "/settings/admin-keys", icon: <KeyRound className="h-5 w-5" /> },
];
```

`KeyRound` is already imported at line 17. No new imports needed.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gishantsingh/dev/projects/orion/dashboard
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/sidebar.tsx
git commit -m "feat(ORION-248): add Admin API Keys nav link to sidebar"
```

---

## Task 13: Cleanup — remove NVIDIA_API_KEY from .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

Find this block in `.env.example`:

```
# ── Provider Service (AI Gateway) ──
PROVIDER_URL=http://provider:8008
NVIDIA_API_KEY=nvapi-                      # Get free credits at build.nvidia.com
PROVIDER_LLM_MODEL=meta/llama-3.3-70b-instruct
```

Replace with:

```
# ── Provider Service (AI Gateway) ──
PROVIDER_URL=http://provider:8008
# Provider API keys are configured via the dashboard Admin → API Keys panel.
# Do not put provider API keys in environment files — they are stored encrypted
# in the Identity service database and rotatable without restarting services.
PROVIDER_LLM_MODEL=meta/llama-3.3-70b-instruct
```

- [ ] **Step 2: Verify NVIDIA_API_KEY is gone from provider directory**

```bash
grep -r "NVIDIA_API_KEY" /home/gishantsingh/dev/projects/orion/services/provider/ /home/gishantsingh/dev/projects/orion/.env.example
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(ORION-248): remove NVIDIA_API_KEY from env.example, add admin panel guidance"
```

---

## Task 14: Final verification — acceptance criteria check

- [ ] **Step 1: Grep for any remaining env-var API key reads in provider**

```bash
grep -rn "NVIDIA_API_KEY\|os.getenv.*KEY" /home/gishantsingh/dev/projects/orion/services/provider/src/
```

Expected: No output. (Non-secret config like `PROVIDER_LLM_MODEL` is still fine.)

- [ ] **Step 2: Run full Python test suite**

```bash
cd /home/gishantsingh/dev/projects/orion
make py-test
```

Expected: All tests pass.

- [ ] **Step 3: Run dashboard TypeScript check**

```bash
cd /home/gishantsingh/dev/projects/orion/dashboard
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run all linters**

```bash
cd /home/gishantsingh/dev/projects/orion
make check
```

Expected: No lint errors.

- [ ] **Step 5: Send completion notification**

```bash
openclaw message send --channel telegram --target 1282424511 --account nova --message "✅ Orion ORION-248 complete: Centralised API key config layer done. No more hardcoded keys — all managed via dashboard admin panel."
```

If any step above failed, run instead:

```bash
openclaw message send --channel telegram --target 1282424511 --account nova --message "❌ Orion ORION-248 FAILED: [brief error summary]."
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by task |
|---|---|
| No `NVIDIA_API_KEY` env read in Provider Service | Tasks 8, 9, 13 |
| `system_api_keys` table | Task 1 |
| `SystemKeyRepository` with `get`, `upsert`, `list_providers` | Task 2 |
| `PUT /api/v1/admin/keys/{provider}` (admin-only, encrypted) | Task 3 |
| `GET /api/v1/admin/keys` (returns `is_configured` only) | Task 3 |
| `GET /api/v1/internal/system-keys/{provider}` for Provider | Task 4 |
| `IdentityClient.get_system_api_key()` | Task 6 |
| `KeyResolver`: per-user → system (5min TTL) → 503 | Task 7 |
| Wire `KeyResolver` into Provider lifespan | Task 8 |
| All three routes use `KeyResolver` | Task 9 |
| Dashboard Admin API Keys page | Task 11 |
| Admin nav link (admin users only) | Task 12 |
| `.env.example` guidance | Task 13 |
| Gateway proxy routes for admin keys | **Not needed** — existing identity proxy at `/api/v1/identity/*` handles it by stripping the service name segment |

### Type consistency check

- `SystemKeyRepository.list_providers()` takes `frozenset[str]` and returns `list[dict[str, Any]]` with keys `provider` and `is_configured`. The admin route calls `SystemKeyStatus(**i)` — `SystemKeyStatus` has `provider: str` and `is_configured: bool`. ✓
- `KeyResolver.resolve()` takes `str | None` and returns `str` or raises `KeyUnavailableError`. Routes catch `KeyUnavailableError`. ✓
- `IdentityClient.get_system_api_key()` returns `str | None`. `KeyResolver` checks truthiness before returning. ✓
- `saveSystemKey` sends `{ key: string }` as body. The admin route expects `UpsertSystemKeyRequest` with `key: str`. ✓
- `listSystemKeys()` returns `SystemKeyStatus[]`. The page maps `is_configured: boolean` to `ConfiguredBadge`. ✓

### Placeholder check

All steps contain complete, runnable code. No TBDs.
