"""Conditional edge routing for the content creation graph."""

from __future__ import annotations

from langgraph.graph import END

from .state import OrionState, PipelineStage


def route_after_strategist(state: OrionState) -> str:
    """Decide next node after the strategist. Routes to 'creator' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator"


def route_after_creator(state: OrionState) -> str:
    """Decide next node after the creator. Routes to END in all cases."""
    return END


def route_after_creator_hitl(state: OrionState) -> str:
    """Decide next node after creator when HITL is enabled.
    Routes to 'creator_review' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator_review"
