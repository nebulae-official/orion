"""Repository for publish records and social accounts."""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import PublishRecord, SocialAccount

logger = structlog.get_logger(__name__)


class PublishRepository:
    """Data access for publish records and social accounts."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Social Accounts ───────────────────────────────────────────

    async def create_account(self, account: SocialAccount) -> SocialAccount:
        self.session.add(account)
        await self.session.flush()
        return account

    async def list_accounts(self, active_only: bool = True) -> list[SocialAccount]:
        stmt = select(SocialAccount)
        if active_only:
            stmt = stmt.where(SocialAccount.is_active.is_(True))
        result = await self.session.execute(stmt.order_by(SocialAccount.created_at.desc()))
        return list(result.scalars().all())

    async def get_account(self, account_id: UUID) -> SocialAccount | None:
        return await self.session.get(SocialAccount, account_id)

    async def get_account_for_platform(self, platform: str) -> SocialAccount | None:
        stmt = (
            select(SocialAccount)
            .where(SocialAccount.platform == platform, SocialAccount.is_active.is_(True))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_account(self, account_id: UUID) -> bool:
        account = await self.session.get(SocialAccount, account_id)
        if account is None:
            return False
        await self.session.delete(account)
        await self.session.flush()
        return True

    # ── Publish Records ───────────────────────────────────────────

    async def create_record(self, record: PublishRecord) -> PublishRecord:
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_records(
        self,
        content_id: UUID | None = None,
        limit: int = 50,
    ) -> list[PublishRecord]:
        stmt = select(PublishRecord).order_by(PublishRecord.created_at.desc()).limit(limit)
        if content_id:
            stmt = stmt.where(PublishRecord.content_id == content_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
