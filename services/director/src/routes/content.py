"""Content generation and retrieval endpoints."""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import ContentStatus
from orion_common.db.session import get_session

from ..repositories.content_repo import ContentRepository
from ..schemas import (
    ContentListItem,
    GenerateContentRequest,
    GenerateContentResponse,
    ScriptResponse,
    VisualPromptsResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/content", tags=["content"])


def _get_pipeline():
    """Return the global ContentPipeline instance (set during lifespan)."""
    from ..main import _pipeline  # noqa: WPS436

    if _pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialised")
    return _pipeline


@router.post("/generate", response_model=GenerateContentResponse, status_code=201)
async def generate_content(
    request: GenerateContentRequest,
    session: AsyncSession = Depends(get_session),
):
    """Trigger content generation from a trend."""
    pipeline = _get_pipeline()

    await logger.ainfo(
        "content_generation_requested",
        trend_id=str(request.trend_id),
        trend_topic=request.trend_topic,
    )

    result = await pipeline.run(
        session,
        trend_id=request.trend_id,
        trend_topic=request.trend_topic,
        niche=request.niche,
        target_platform=request.target_platform.value,
        tone=request.tone,
        visual_style=request.visual_style,
    )

    script = result["script"]
    visual_prompts = result["visual_prompts"]

    repo = ContentRepository(session)
    content = await repo.get_by_id(result["content_id"])

    return GenerateContentResponse(
        content_id=content.id,
        trend_id=content.trend_id,
        title=content.title,
        status=content.status.value,
        script=ScriptResponse.from_generated(script),
        visual_prompts=VisualPromptsResponse(
            style_guide=visual_prompts.style_guide,
            prompts=visual_prompts.prompts,
        ),
        created_at=content.created_at,
    )


@router.get("", response_model=list[ContentListItem])
async def list_content(
    status: str | None = Query(None, description="Filter by content status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List content items, optionally filtered by status."""
    content_status = None
    if status is not None:
        try:
            content_status = ContentStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Valid: {[s.value for s in ContentStatus]}",
            )

    repo = ContentRepository(session)
    items = await repo.list_by_status(status=content_status, limit=limit, offset=offset)

    return [
        ContentListItem(
            id=item.id,
            trend_id=item.trend_id,
            title=item.title,
            hook=item.hook,
            status=item.status.value,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.get("/{content_id}", response_model=GenerateContentResponse)
async def get_content(
    content_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Get a single content item by ID."""
    repo = ContentRepository(session)
    content = await repo.get_by_id(content_id)

    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")

    script_resp = None
    visual_resp = None

    if content.script_body and content.hook:
        script_resp = ScriptResponse(
            hook=content.hook,
            body=content.script_body,
            cta="",
            visual_cues=[],
        )

    if content.visual_prompts:
        visual_resp = VisualPromptsResponse.model_validate(content.visual_prompts)

    return GenerateContentResponse(
        content_id=content.id,
        trend_id=content.trend_id,
        title=content.title,
        status=content.status.value,
        script=script_resp,
        visual_prompts=visual_resp,
        created_at=content.created_at,
    )


@router.get("/{content_id}/visual-prompts", response_model=VisualPromptsResponse)
async def get_visual_prompts(
    content_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Get the visual prompts for a content item."""
    repo = ContentRepository(session)
    content = await repo.get_by_id(content_id)

    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.visual_prompts is None:
        raise HTTPException(status_code=404, detail="No visual prompts for this content")

    return VisualPromptsResponse.model_validate(content.visual_prompts)
