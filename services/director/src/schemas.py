"""Request / response schemas for the Director REST API."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from .agents.script_generator import GeneratedScript, TargetPlatform
from .agents.visual_prompter import VisualPrompt


class GenerateContentRequest(BaseModel):
    """Payload to trigger content generation from a trend."""

    trend_id: uuid.UUID = Field(..., description="ID of the detected trend")
    trend_topic: str = Field(..., description="Topic of the trend")
    niche: str = Field(default="technology", description="Content niche")
    target_platform: TargetPlatform = Field(default=TargetPlatform.youtube_shorts)
    tone: str = Field(default="informative and engaging")
    visual_style: str = Field(default="cinematic", description="Visual generation style")


class ScriptResponse(BaseModel):
    """Serialised view of a generated script."""

    hook: str
    body: str
    cta: str
    visual_cues: list[str]

    @classmethod
    def from_generated(cls, script: GeneratedScript) -> ScriptResponse:
        return cls(
            hook=script.hook,
            body=script.body,
            cta=script.cta,
            visual_cues=script.visual_cues,
        )


class VisualPromptsResponse(BaseModel):
    """Serialised view of visual prompts."""

    style_guide: str
    prompts: list[VisualPrompt]


class GenerateContentResponse(BaseModel):
    """Response after successfully queuing / completing content generation."""

    content_id: uuid.UUID
    trend_id: uuid.UUID
    title: str
    status: str
    thread_id: str | None = None
    script: ScriptResponse | None = None
    visual_prompts: VisualPromptsResponse | None = None
    created_at: datetime


class ContentListItem(BaseModel):
    """Lightweight content item for listing."""

    id: uuid.UUID
    trend_id: uuid.UUID
    title: str
    hook: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class HITLResumeRequest(BaseModel):
    """Payload to resume a paused HITL pipeline."""

    thread_id: str = Field(..., description="Thread ID of the paused graph execution")
    approved: bool = Field(..., description="Whether the human approves the current output")
    feedback: str | None = Field(default=None, description="Optional rejection feedback")


class HITLStatusResponse(BaseModel):
    """Response showing the current HITL interrupt state."""

    thread_id: str
    interrupted: bool
    stage: str | None = None
    review_payload: dict | None = None
