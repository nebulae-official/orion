"""Repository for user_api_keys — encrypted per-user provider API keys."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from orion_common.db import Base
from sqlalchemy import DateTime, String, Text, delete, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from ..encryption import decrypt, encrypt

logger = structlog.get_logger(__name__)


class UserApiKey(Base):
    """Stores an encrypted API key for a user + provider pair."""

    __tablename__ = "user_api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class KeyRepository:
    """CRUD operations for encrypted user API keys."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, user_id: uuid.UUID, provider: str, api_key: str) -> UserApiKey:
        """Store (or update) an encrypted API key for a user + provider."""
        existing = await self._get(user_id, provider)
        now = datetime.now(UTC)

        if existing:
            existing.encrypted_key = encrypt(api_key)
            existing.updated_at = now
            await self._session.commit()
            await self._session.refresh(existing)
            return existing

        record = UserApiKey(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypt(api_key),
            created_at=now,
            updated_at=now,
        )
        self._session.add(record)
        await self._session.commit()
        await self._session.refresh(record)
        await logger.ainfo("api_key_stored", user_id=str(user_id), provider=provider)
        return record

    async def get_decrypted(self, user_id: uuid.UUID, provider: str) -> str | None:
        """Return the decrypted API key for a user + provider, or ``None``."""
        record = await self._get(user_id, provider)
        if record is None:
            return None
        return decrypt(record.encrypted_key)

    async def list_providers(self, user_id: uuid.UUID) -> list[dict[str, Any]]:
        """Return metadata (no secrets) for all stored keys of a user."""
        stmt = (
            select(UserApiKey.provider, UserApiKey.created_at, UserApiKey.updated_at)
            .where(UserApiKey.user_id == user_id)
            .order_by(UserApiKey.provider)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            {
                "provider": r.provider,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ]

    async def delete(self, user_id: uuid.UUID, provider: str) -> bool:
        """Delete a stored key. Returns ``True`` if a row was removed."""
        result = await self._session.execute(
            delete(UserApiKey).where(
                UserApiKey.user_id == user_id,
                UserApiKey.provider == provider,
            )
        )
        await self._session.commit()
        return result.rowcount > 0

    async def _get(self, user_id: uuid.UUID, provider: str) -> UserApiKey | None:
        stmt = select(UserApiKey).where(
            UserApiKey.user_id == user_id,
            UserApiKey.provider == provider,
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()
