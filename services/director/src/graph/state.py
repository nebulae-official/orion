"""OrionState — the shared state schema for the content creation graph."""

from __future__ import annotations

import operator
from enum import Enum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict


class PipelineStage(str, Enum):
    """Which node the pipeline is currently at."""

    STRATEGIST = "strategist"
    CREATOR = "creator"
    ANALYST = "analyst"
    COMPLETE = "complete"
    FAILED = "failed"


class HITLDecision(BaseModel):
    """Record of a human-in-the-loop approval or rejection."""

    stage: PipelineStage = Field(..., description="Stage where the decision was made")
    approved: bool = Field(..., description="Whether the human approved")
    feedback: str | None = Field(default=None, description="Optional rejection feedback")


class OrionState(TypedDict):
    """Shared state flowing through the LangGraph content pipeline.

    Required keys (total=True by default) are set at pipeline start.
    Optional keys use NotRequired and are populated by individual nodes.
    """

    # --- Required: set at pipeline start ---
    content_id: UUID
    trend_id: UUID
    trend_topic: str
    niche: str
    target_platform: str
    tone: str
    visual_style: str
    current_stage: PipelineStage

    # --- Strategist outputs (optional) ---
    script_hook: NotRequired[str]
    script_body: NotRequired[str]
    script_cta: NotRequired[str]
    visual_cues: NotRequired[list[str]]

    # --- Analyst outputs (optional) ---
    critique_score: NotRequired[float]
    critique_feedback: NotRequired[str]

    # --- Creator outputs (optional) ---
    visual_prompts: NotRequired[dict[str, Any]]

    # --- HITL tracking (accumulates via operator.add reducer) ---
    hitl_decisions: NotRequired[Annotated[list[dict[str, Any]], operator.add]]

    # --- Error tracking (optional) ---
    error: NotRequired[str | None]
