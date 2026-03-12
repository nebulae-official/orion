"""Graph node functions — thin wrappers around existing agent classes."""

from __future__ import annotations

from typing import Any

import structlog

from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import GeneratedScript, ScriptGenerator, ScriptRequest
from ..agents.visual_prompter import VisualPrompter
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
        )

        return {
            "script_hook": script.hook,
            "script_body": script.body,
            "script_cta": script.cta,
            "visual_cues": script.visual_cues,
            "critique_score": critique_result.confidence_score,
            "critique_feedback": critique_result.feedback,
            "current_stage": PipelineStage.CREATOR,
        }

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
