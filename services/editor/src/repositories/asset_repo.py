"""Repository for managing MediaAsset records from the Editor service."""

from __future__ import annotations

import uuid
from typing import Any

from orion_common.db.models import AssetType, MediaAsset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class EditorAssetRepository:
    """CRUD operations for media assets created by the Editor."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        content_id: uuid.UUID,
        asset_type: AssetType,
        provider: str,
        file_path: str,
        metadata: dict[str, Any] | None = None,
    ) -> MediaAsset:
        """Persist a new MediaAsset and return it."""
        asset = MediaAsset(
            content_id=content_id,
            asset_type=asset_type,
            provider=provider,
            file_path=file_path,
            metadata_=metadata,
        )
        self._session.add(asset)
        await self._session.flush()
        return asset

    async def get_by_content_id(
        self,
        content_id: uuid.UUID,
        asset_type: AssetType | None = None,
    ) -> list[MediaAsset]:
        """Return all media assets for *content_id*, optionally filtered by type."""
        stmt = select(MediaAsset).where(MediaAsset.content_id == content_id)
        if asset_type is not None:
            stmt = stmt.where(MediaAsset.asset_type == asset_type)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
