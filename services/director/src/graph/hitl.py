"""Human-in-the-loop interrupt gate helpers."""

from __future__ import annotations

from typing import Any

from .state import OrionState


def build_strategist_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after strategist."""
    return {
        "stage": "strategist",
        "instruction": "Review the generated script and critique. Approve to proceed to visual prompt extraction, or reject with feedback.",
        "script": {
            "hook": state.get("script_hook", ""),
            "body": state.get("script_body", ""),
            "cta": state.get("script_cta", ""),
            "visual_cues": state.get("visual_cues", []),
        },
        "critique": {
            "score": state.get("critique_score", 0.0),
            "feedback": state.get("critique_feedback", ""),
        },
    }


def build_creator_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after creator."""
    return {
        "stage": "creator",
        "instruction": "Review the visual prompts. Approve to finalise content, or reject with feedback.",
        "visual_prompts": state.get("visual_prompts", {}),
        "script_summary": {
            "hook": state.get("script_hook", ""),
            "cta": state.get("script_cta", ""),
        },
    }


def build_analyst_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after analyst."""
    return {
        "stage": "analyst",
        "instruction": "Review the performance analysis and improvement suggestions. Approve to cycle back for improvements, or reject to finalise as-is.",
        "performance_summary": state.get("performance_summary", ""),
        "improvement_suggestions": state.get("improvement_suggestions", []),
        "analyst_score": state.get("analyst_score", 0.0),
        "iteration_count": state.get("iteration_count", 0),
        "max_iterations": state.get("max_iterations", 3),
    }
