"""Content publishing endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.session import get_session

from src.repositories.publish_repo import PublishRepository
from src.schemas import PublishRecordResponse

router = APIRouter(prefix="/api/v1/publish", tags=["publish"])


@router.get("/history", response_model=list[PublishRecordResponse])
async def list_publish_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    content_id: UUID | None = None,
    limit: int = 50,
) -> list:
    """List publish history records."""
    repo = PublishRepository(session)
    return await repo.list_records(content_id=content_id, limit=limit)
