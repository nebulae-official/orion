"""Content creation pipeline — wraps the LangGraph StateGraph."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import ContentStatus, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from ..agents.script_generator import GeneratedScript
from ..agents.visual_prompter import VisualPromptSet
from ..graph.state import OrionState, PipelineStage
from ..memory.vector_store import VectorMemory
from ..repositories.content_repo import ContentRepository

logger = structlog.get_logger(__name__)


class ContentPipeline:
    """Orchestrates content creation via a LangGraph StateGraph."""

    def __init__(
        self,
        graph: CompiledStateGraph,
        event_bus: EventBus,
        vector_memory: VectorMemory | None = None,
    ) -> None:
        self._graph = graph
        self._event_bus = event_bus
        self._vector_memory = vector_memory

    async def run(
        self,
        session: AsyncSession,
        *,
        trend_id: uuid.UUID,
        trend_topic: str,
        niche: str = "technology",
        target_platform: str = "youtube_shorts",
        tone: str = "informative and engaging",
        visual_style: str = "cinematic",
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute the content creation pipeline via LangGraph."""
        repo = ContentRepository(session)

        # 1. Create a draft content record
        content = await repo.create(
            trend_id=trend_id,
            title=f"Content for: {trend_topic}",
            status=ContentStatus.generating,
        )
        content_id = content.id

        await logger.ainfo("pipeline_started", content_id=str(content_id), trend_topic=trend_topic)

        # 2. Create pipeline run record
        pipeline_run = await repo.create_pipeline_run(content_id, stage="langgraph_pipeline")
        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.running)

        # 3. Build initial state
        initial_state: OrionState = {
            "content_id": content_id,
            "trend_id": trend_id,
            "trend_topic": trend_topic,
            "niche": niche,
            "target_platform": target_platform,
            "tone": tone,
            "visual_style": visual_style,
            "current_stage": PipelineStage.STRATEGIST,
        }

        # 4. Invoke the graph
        config = {}
        if thread_id:
            config = {"configurable": {"thread_id": thread_id}}

        try:
            final_state = await self._graph.ainvoke(initial_state, config=config or None)
        except Exception as exc:
            await repo.update_pipeline_run(
                pipeline_run.id, PipelineStatus.failed, error_message=str(exc)
            )
            await repo.update_status(content_id, ContentStatus.draft)
            await session.commit()
            raise

        # 5. Check for graph-level failure
        if final_state.get("current_stage") == PipelineStage.FAILED:
            error_msg = final_state.get("error", "Unknown graph error")
            await repo.update_pipeline_run(
                pipeline_run.id, PipelineStatus.failed, error_message=error_msg
            )
            await repo.update_status(content_id, ContentStatus.draft)
            await session.commit()
            raise RuntimeError(f"Pipeline failed: {error_msg}")

        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.completed)

        # 6. Extract results from final state
        script = GeneratedScript(
            hook=final_state.get("script_hook", ""),
            body=final_state.get("script_body", ""),
            cta=final_state.get("script_cta", ""),
            visual_cues=final_state.get("visual_cues", []),
        )

        visual_prompts_dict = final_state.get("visual_prompts", {})
        prompt_set = (
            VisualPromptSet.model_validate(visual_prompts_dict)
            if visual_prompts_dict
            else None
        )

        critique_score = final_state.get("critique_score", 0.0)

        await repo.update_content(
            content_id,
            script_body=script.body,
            hook=script.hook,
            visual_prompts=visual_prompts_dict or None,
            status=ContentStatus.review,
        )
        await session.commit()

        # 7. Store in vector memory
        if self._vector_memory is not None:
            try:
                await self._vector_memory.store_hook(
                    hook_text=script.hook,
                    engagement_score=critique_score,
                    content_id=str(content_id),
                )
                await self._vector_memory.store_content(
                    script_text=script.body,
                    content_id=str(content_id),
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            except Exception:
                await logger.aexception("vector_memory_store_failed", content_id=str(content_id))

        # 8. Publish CONTENT_CREATED event
        await self._event_bus.publish(
            Channels.CONTENT_CREATED,
            {
                "content_id": str(content_id),
                "trend_id": str(trend_id),
                "title": content.title,
                "status": ContentStatus.review.value,
            },
        )

        await logger.ainfo("pipeline_completed", content_id=str(content_id))

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {
                "confidence_score": critique_score,
                "feedback": final_state.get("critique_feedback", ""),
            },
        }

    async def resume(
        self,
        session: AsyncSession,
        *,
        thread_id: str,
        decision: dict,
    ) -> dict[str, Any]:
        """Resume a paused HITL pipeline with a human decision."""
        config = {"configurable": {"thread_id": thread_id}}

        final_state = await self._graph.ainvoke(
            Command(resume=decision), config=config,
        )

        if final_state.get("current_stage") == PipelineStage.FAILED:
            raise RuntimeError(f"Pipeline failed: {final_state.get('error', 'Unknown')}")

        script = GeneratedScript(
            hook=final_state.get("script_hook", ""),
            body=final_state.get("script_body", ""),
            cta=final_state.get("script_cta", ""),
            visual_cues=final_state.get("visual_cues", []),
        )

        visual_prompts_dict = final_state.get("visual_prompts", {})
        prompt_set = (
            VisualPromptSet.model_validate(visual_prompts_dict)
            if visual_prompts_dict
            else None
        )

        # Persist if not already persisted
        repo = ContentRepository(session)
        content_id = final_state.get("content_id")
        if content_id:
            await repo.update_content(
                content_id,
                script_body=script.body,
                hook=script.hook,
                visual_prompts=visual_prompts_dict or None,
                status=ContentStatus.review,
            )
            await session.commit()

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {
                "confidence_score": final_state.get("critique_score", 0.0),
                "feedback": final_state.get("critique_feedback", ""),
            },
        }
