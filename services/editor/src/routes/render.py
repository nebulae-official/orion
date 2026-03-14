"""API routes for video rendering, TTS, and caption generation."""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException
from orion_common.db.models import PipelineRun
from orion_common.db.session import get_session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..captions.formatter import to_srt
from ..captions.whisper_stt import WhisperCaptioner
from ..providers.base import TTSProvider, TTSRequest
from ..schemas import (
    CaptionRequest,
    CaptionResponse,
    CaptionSegmentSchema,
    RenderRequest,
    RenderResponse,
    TTSGenerateRequest,
    TTSGenerateResponse,
)
from ..services.render_pipeline import RenderPipeline

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/editor", tags=["editor"])

# Module-level singletons (initialised by main.py lifespan via init_components)
_render_pipeline: RenderPipeline | None = None
_tts_provider: TTSProvider | None = None
_captioner: WhisperCaptioner | None = None


def set_render_pipeline(pipeline: RenderPipeline) -> None:
    """Called during application startup to inject the pipeline instance."""
    global _render_pipeline
    _render_pipeline = pipeline


def set_components(tts: TTSProvider, captioner: WhisperCaptioner) -> None:
    """Inject standalone components for individual endpoints."""
    global _tts_provider, _captioner
    _tts_provider = tts
    _captioner = captioner


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@router.post("/render", response_model=RenderResponse)
async def trigger_render(
    body: RenderRequest,
    session: AsyncSession = Depends(get_session),
) -> RenderResponse:
    """Trigger the full render pipeline for a content piece."""
    if _render_pipeline is None:
        raise HTTPException(
            status_code=503, detail="Render pipeline not initialised"
        )

    try:
        run = await _render_pipeline.render(
            content_id=body.content_id,
            session=session,
            voice_id=body.voice_id,
            subtitle_style=body.subtitle_style,
            video_width=body.video_width,
            video_height=body.video_height,
        )
        return RenderResponse(
            content_id=body.content_id,
            status=run.status.value,
            pipeline_run_id=run.id,
            video_path=None,
            message="Render completed successfully",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        await logger.aexception("render_endpoint_error")
        raise HTTPException(
            status_code=500,
            detail="Internal rendering error",
        )


@router.post("/tts", response_model=TTSGenerateResponse)
async def generate_tts(body: TTSGenerateRequest) -> TTSGenerateResponse:
    """Generate TTS audio from text (standalone endpoint)."""
    if _tts_provider is None:
        raise HTTPException(
            status_code=503, detail="TTS provider not initialised"
        )

    result = await _tts_provider.synthesize(
        TTSRequest(
            text=body.text,
            voice_id=body.voice_id,
            speed=body.speed,
            output_format=body.output_format,
        )
    )
    return TTSGenerateResponse(
        file_path=result.file_path,
        duration_seconds=result.duration_seconds,
        provider=result.provider,
    )


@router.post("/captions", response_model=CaptionResponse)
async def generate_captions(body: CaptionRequest) -> CaptionResponse:
    """Generate captions from an audio file (standalone endpoint)."""
    if _captioner is None:
        raise HTTPException(
            status_code=503, detail="Captioner not initialised"
        )

    result = await _captioner.transcribe(body.audio_path, language=body.language)
    srt = to_srt(result)

    return CaptionResponse(
        segments=[
            CaptionSegmentSchema(start=s.start, end=s.end, text=s.text)
            for s in result.segments
        ],
        full_text=result.full_text,
        language=result.language,
        srt=srt,
    )


@router.get("/render/{content_id}/status", response_model=RenderResponse)
async def get_render_status(
    content_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> RenderResponse:
    """Get the latest render pipeline status for a content piece."""
    stmt = (
        select(PipelineRun)
        .where(PipelineRun.content_id == content_id)
        .order_by(PipelineRun.started_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=404,
            detail=f"No render pipeline found for content {content_id}",
        )

    return RenderResponse(
        content_id=content_id,
        status=run.status.value,
        pipeline_run_id=run.id,
        message=run.error_message or "",
    )
