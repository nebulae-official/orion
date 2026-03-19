"""Scheduled cleanup of expired refresh tokens."""

from datetime import UTC, datetime

import structlog
from orion_common.db.models import RefreshToken
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


async def prune_expired_tokens(session: AsyncSession) -> int:
    """Delete expired and revoked refresh tokens."""
    cutoff = datetime.now(UTC)
    stmt = delete(RefreshToken).where(
        RefreshToken.expires_at < cutoff,
    )
    result = await session.execute(stmt)
    await session.commit()
    count = result.rowcount
    logger.info("pruned_expired_tokens", count=count)
    return count
