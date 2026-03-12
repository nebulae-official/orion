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
    """Decide next node after the creator. Routes to 'analyst' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "analyst"


def route_after_creator_hitl(state: OrionState) -> str:
    """Decide next node after creator when HITL is enabled.
    Routes to 'creator_review' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator_review"


def route_after_analyst(state: OrionState) -> str:
    """Decide next node after analyst (non-HITL path). Always routes to END."""
    return END


def route_after_analyst_hitl(state: OrionState) -> str:
    """Route after analyst HITL gate. Cycles back to strategist if approved
    and iteration limit not reached, otherwise END."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    decisions = state.get("hitl_decisions", [])
    if not decisions:
        return END
    last = decisions[-1]
    if not last.get("approved", False):
        return END
    count = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", 3)
    if count < max_iter:
        return "strategist"
    return END
