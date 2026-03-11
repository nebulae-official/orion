"""Repository for MediaAsset persistence."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import AssetType, MediaAsset


class MediaAssetRepository:
    """CRUD operations for media assets."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        content_id: uuid.UUID,
        asset_type: AssetType,
        provider: str,
        file_path: str,
        metadata: dict | None = None,
    ) -> MediaAsset:
        """Persist a new media asset record."""
        asset = MediaAsset(
            content_id=content_id,
            asset_type=asset_type,
            provider=provider,
            file_path=file_path,
            metadata_=metadata,
        )
        self._session.add(asset)
        await self._session.commit()
        await self._session.refresh(asset)
        return asset

    async def get_by_id(self, asset_id: uuid.UUID) -> MediaAsset | None:
        """Fetch a single asset by primary key."""
        return await self._session.get(MediaAsset, asset_id)

    async def get_by_content_id(
        self, content_id: uuid.UUID
    ) -> Sequence[MediaAsset]:
        """Return all assets linked to a given content piece."""
        stmt = (
            select(MediaAsset)
            .where(MediaAsset.content_id == content_id)
            .order_by(MediaAsset.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def list_recent(self, limit: int = 50) -> Sequence[MediaAsset]:
        """Return the most recently created assets."""
        stmt = (
            select(MediaAsset)
            .order_by(MediaAsset.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
