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
        configured = {row.provider for row in (await self._session.execute(stmt)).all()}
        return [{"provider": p, "is_configured": p in configured} for p in sorted(all_providers)]
