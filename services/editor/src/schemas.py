"""Pydantic request/response schemas for the Editor service API."""

from __future__ import annotations

import uuid

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


class RenderRequest(BaseModel):
    """Request to render a content piece into a final video."""

    content_id: uuid.UUID
    voice_id: str = "default"
    subtitle_style: str = "tiktok"  # "tiktok", "youtube", "minimal"
    video_width: int = 1080
    video_height: int = 1920


class RenderResponse(BaseModel):
    """Response after a render job has been queued / completed."""

    content_id: uuid.UUID
    status: str
    pipeline_run_id: uuid.UUID | None = None
    video_path: str | None = None
    message: str = ""


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------


class TTSGenerateRequest(BaseModel):
    """Request to generate TTS audio from text."""

    text: str
    voice_id: str = "default"
    speed: float = 1.0
    output_format: str = "mp3"


class TTSGenerateResponse(BaseModel):
    """Response with the generated TTS audio details."""

    file_path: str
    duration_seconds: float
    provider: str


# ---------------------------------------------------------------------------
# Captions
# ---------------------------------------------------------------------------


class CaptionRequest(BaseModel):
    """Request to generate captions from an audio file."""

    audio_path: str
    language: str = "en"


class CaptionSegmentSchema(BaseModel):
    """A single caption segment."""

    start: float
    end: float
    text: str


class CaptionResponse(BaseModel):
    """Response with generated captions."""

    segments: list[CaptionSegmentSchema]
    full_text: str
    language: str
    srt: str = ""
