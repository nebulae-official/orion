"""Graph node functions — thin wrappers around existing agent classes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import structlog
from langgraph.types import interrupt

from ..agents.analyst import AnalystAgent
from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import GeneratedScript, ScriptGenerator, ScriptRequest
from ..agents.visual_prompter import VisualPrompter
from .hitl import build_analyst_review_payload, build_creator_review_payload, build_strategist_review_payload
from .state import OrionState, PipelineStage

logger = structlog.get_logger(__name__)


async def strategist_node(
    state: OrionState,
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
) -> dict[str, Any]:
    """Generate an H-V-C script and critique it."""
    await logger.ainfo("strategist_node_started", trend_topic=state["trend_topic"])

    try:
        suggestions = state.get("improvement_suggestions", [])
        iteration = state.get("iteration_count", 0)

        request = ScriptRequest(
            trend_topic=state["trend_topic"],
            niche=state.get("niche", "technology"),
            target_platform=state.get("target_platform", "youtube_shorts"),
            tone=state.get("tone", "informative and engaging"),
        )

        script: GeneratedScript = await script_generator.generate_script(request)

        script, critique_result = await critique_agent.critique_and_refine(
            script=script, request=request,
        )

        await logger.ainfo(
            "strategist_node_completed",
            hook_length=len(script.hook.split()),
            critique_score=critique_result.confidence_score,
            iteration=iteration,
        )

        result: dict[str, Any] = {
            "script_hook": script.hook,
            "script_body": script.body,
            "script_cta": script.cta,
            "visual_cues": script.visual_cues,
            "critique_score": critique_result.confidence_score,
            "critique_feedback": critique_result.feedback,
            "current_stage": PipelineStage.CREATOR,
        }

        # Increment iteration count on re-entry (feedback loop)
        if suggestions:
            result["iteration_count"] = iteration + 1

        return result

    except Exception as exc:
        await logger.aexception("strategist_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }


async def creator_node(
    state: OrionState,
    *,
    visual_prompter: VisualPrompter,
) -> dict[str, Any]:
    """Extract visual prompts from the script produced by the strategist."""
    await logger.ainfo("creator_node_started", content_id=str(state.get("content_id", "")))

    try:
        script = GeneratedScript(
            hook=state["script_hook"],
            body=state["script_body"],
            cta=state["script_cta"],
            visual_cues=state.get("visual_cues", []),
        )

        prompt_set = await visual_prompter.extract_prompts(
            script, style=state.get("visual_style", "cinematic"),
        )

        await logger.ainfo("creator_node_completed", prompt_count=len(prompt_set.prompts))

        return {
            "visual_prompts": prompt_set.model_dump(),
            "current_stage": PipelineStage.COMPLETE,
        }

    except Exception as exc:
        await logger.aexception("creator_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }


async def strategist_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after strategist: pause for human review of the script."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_strategist_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", True) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo("strategist_hitl_rejected", feedback=feedback)
        return {
            "current_stage": PipelineStage.FAILED,
            "error": f"HITL rejected at strategist: {feedback or 'no feedback'}",
            "hitl_decisions": [{"stage": "strategist", "approved": False, "feedback": feedback}],
        }

    await logger.ainfo("strategist_hitl_approved")
    return {
        "hitl_decisions": [{"stage": "strategist", "approved": True, "feedback": None}],
    }


async def creator_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after creator: pause for human review of visual prompts."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_creator_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", True) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo("creator_hitl_rejected", feedback=feedback)
        return {
            "current_stage": PipelineStage.FAILED,
            "error": f"HITL rejected at creator: {feedback or 'no feedback'}",
            "hitl_decisions": [{"stage": "creator", "approved": False, "feedback": feedback}],
        }

    await logger.ainfo("creator_hitl_approved")
    return {
        "hitl_decisions": [{"stage": "creator", "approved": True, "feedback": None}],
    }


async def analyst_node(
    state: OrionState,
    *,
    analyst_agent: AnalystAgent,
    session_factory: Callable,
) -> dict[str, Any]:
    """Analyze pipeline performance and generate improvement suggestions."""
    await logger.ainfo("analyst_node_started", content_id=str(state.get("content_id", "")))

    try:
        async with session_factory() as session:
            result = await analyst_agent.analyze(
                session=session,
                content_id=state["content_id"],
                niche=state.get("niche", "technology"),
                script_hook=state.get("script_hook", ""),
                script_body=state.get("script_body", ""),
                critique_score=state.get("critique_score", 0.0),
            )

        await logger.ainfo(
            "analyst_node_completed",
            overall_score=result.overall_score,
            suggestion_count=len(result.suggestions),
        )

        return {
            "performance_summary": result.performance_summary,
            "improvement_suggestions": [s.model_dump() for s in result.suggestions],
            "analyst_score": result.overall_score,
            "current_stage": PipelineStage.COMPLETE,
        }

    except Exception as exc:
        await logger.aexception("analyst_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }


async def analyst_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after analyst: pause for human review of analysis."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_analyst_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", False) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo("analyst_hitl_rejected", feedback=feedback)
        return {
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": False, "feedback": feedback}],
        }

    await logger.ainfo("analyst_hitl_approved")
    return {
        "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
    }
