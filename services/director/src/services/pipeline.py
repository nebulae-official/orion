"""Content creation pipeline — wraps the LangGraph StateGraph."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from orion_common.cost import CostResult
from orion_common.db.models import ContentStatus, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels
from sqlalchemy.ext.asyncio import AsyncSession

from ..agents.script_generator import GeneratedScript
from ..agents.visual_prompter import VisualPromptSet
from ..graph.state import OrionState, PipelineStage
from ..memory.vector_store import VectorMemory
from ..metrics import CONFIDENCE_SCORE, CONTENT_TOTAL, GENERATION_DURATION
from ..repositories.content_repo import ContentRepository

logger = structlog.get_logger(__name__)

# Maps graph node names to (human-readable label, stage number).
# The graph has: strategist → creator → (optional) analyst.
_STAGE_MAP: dict[str, tuple[str, int]] = {
    "strategist": ("Generating & reviewing script", 1),
    "creator": ("Creating visual prompts", 2),
    "analyst": ("Analyzing performance", 3),
}

_STAGES_TOTAL = 4  # up to 3 graph nodes + 1 final "complete"


class ContentPipeline:
    """Orchestrates content creation via a LangGraph StateGraph."""

    def __init__(
        self,
        graph: CompiledStateGraph,
        event_bus: EventBus,
        vector_memory: VectorMemory | None = None,
        checkpointer: Any | None = None,
    ) -> None:
        self._graph = graph
        self._event_bus = event_bus
        self._vector_memory = vector_memory
        self._checkpointer = checkpointer

    async def _emit_stage_progress(
        self,
        session: AsyncSession,
        content_id: uuid.UUID,
        pipeline_run_id: uuid.UUID,
        stage_name: str,
        label: str,
        stages_completed: int,
        stages_total: int,
        user_id: str | None = None,
    ) -> None:
        """Persist pipeline progress and emit a PIPELINE_STAGE_CHANGED event."""
        repo = ContentRepository(session)
        await repo.update_pipeline_progress(pipeline_run_id, label, stages_completed)
        await session.commit()
        await self._event_bus.publish(
            Channels.PIPELINE_STAGE_CHANGED,
            {
                "content_id": str(content_id),
                "pipeline_run_id": str(pipeline_run_id),
                "stage": stage_name,
                "stage_label": label,
                "stages_completed": stages_completed,
                "stages_total": stages_total,
                "status": "running",
                "user_id": str(user_id) if user_id else None,
            },
        )

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
        created_by: str | None = None,
    ) -> dict[str, Any]:
        """Execute the content creation pipeline via LangGraph."""
        repo = ContentRepository(session)

        # 1. Create a draft content record
        content = await repo.create(
            trend_id=trend_id,
            title=f"Content for: {trend_topic}",
            status=ContentStatus.generating,
            created_by=uuid.UUID(created_by) if created_by else None,
        )
        content_id = content.id

        await logger.ainfo("pipeline_started", content_id=str(content_id), trend_topic=trend_topic)

        # 2. Create pipeline run record
        pipeline_run = await repo.create_pipeline_run(content_id, stage="langgraph_pipeline")
        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.running)
        CONTENT_TOTAL.labels(status="generating").inc()
        pipeline_start = time.monotonic()

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
            "iteration_count": 0,
            "max_iterations": 3,
        }

        # 4. Invoke the graph
        if not thread_id:
            thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        try:
            # Stream node-by-node so we can emit progress after each step.
            # stream_mode="updates" yields {node_name: state_update_dict}.
            final_state = dict(initial_state)
            async for event in self._graph.astream(initial_state, config=config, stream_mode="updates"):
                node_name = next(iter(event))
                final_state.update(event[node_name])

                if node_name in _STAGE_MAP:
                    label, completed = _STAGE_MAP[node_name]
                    await self._emit_stage_progress(
                        session,
                        content_id,
                        pipeline_run.id,
                        node_name,
                        label,
                        completed,
                        _STAGES_TOTAL,
                        user_id=created_by,
                    )
        except Exception as exc:
            await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.failed, error_message=str(exc))
            await repo.update_status(content_id, ContentStatus.draft)
            CONTENT_TOTAL.labels(status="failed").inc()
            await session.commit()
            await self.cleanup_checkpoints(thread_id)
            raise

        # 5. Check for graph-level failure
        if final_state.get("current_stage") == PipelineStage.FAILED:
            error_msg = final_state.get("error", "Unknown graph error")
            await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.failed, error_message=error_msg)
            await repo.update_status(content_id, ContentStatus.draft)
            CONTENT_TOTAL.labels(status="failed").inc()
            await session.commit()
            raise RuntimeError(f"Pipeline failed: {error_msg}")

        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.completed)
        await self._emit_stage_progress(
            session,
            content_id,
            pipeline_run.id,
            "complete",
            "Pipeline complete",
            _STAGES_TOTAL,
            _STAGES_TOTAL,
            user_id=created_by,
        )

        # 6. Extract results from final state
        script = GeneratedScript(
            hook=final_state.get("script_hook", ""),
            body=final_state.get("script_body", ""),
            cta=final_state.get("script_cta", ""),
            visual_cues=final_state.get("visual_cues", []),
        )

        visual_prompts_dict = final_state.get("visual_prompts", {})
        prompt_set = VisualPromptSet.model_validate(visual_prompts_dict) if visual_prompts_dict else None

        critique_score = final_state.get("critique_score", 0.0)

        pipeline_duration = time.monotonic() - pipeline_start
        GENERATION_DURATION.labels(stage="full_pipeline").observe(pipeline_duration)
        CONFIDENCE_SCORE.observe(critique_score)
        CONTENT_TOTAL.labels(status="review").inc()

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
                    created_at=datetime.now(UTC).isoformat(),
                )
            except Exception:
                await logger.aexception("vector_memory_store_failed", content_id=str(content_id))

        # 8. Publish CONTENT_CREATED event (only on final completion, not mid-feedback-loop)
        decisions = final_state.get("hitl_decisions", [])
        last_decision = decisions[-1] if decisions else {}
        final_iteration = final_state.get("iteration_count", 0)
        max_iter = final_state.get("max_iterations", 3)
        cycling_back = last_decision.get("approved", False) and final_iteration < max_iter
        is_final = not cycling_back

        if is_final:
            # Flatten visual prompts to description strings for the Media
            # service. The full VisualPromptSet stays in the DB column.
            visual_prompt_strings = [p["description"] for p in visual_prompts_dict.get("prompts", [])] if visual_prompts_dict else []

            # Estimate LLM cost from script length (proxy for output tokens).
            # Input tokens are roughly 2x output for prompt+context overhead.
            output_tokens = len(script.body) // 4 if script.body else 0
            input_tokens = output_tokens * 2
            cost = CostResult.estimate(
                provider="ollama",
                model="llama3",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                category="llm_tokens",
            )

            await self._event_bus.publish(
                Channels.CONTENT_CREATED,
                {
                    "content_id": str(content_id),
                    "trend_id": str(trend_id),
                    "title": content.title,
                    "status": ContentStatus.review.value,
                    "visual_prompts": visual_prompt_strings,
                    "user_id": created_by,
                    "cost": cost.to_dict(),
                },
            )

        await logger.ainfo("pipeline_completed", content_id=str(content_id))

        # 9. Cleanup checkpoints for completed pipeline
        await self.cleanup_checkpoints(thread_id)

        return {
            "content_id": content_id,
            "thread_id": thread_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {
                "confidence_score": critique_score,
                "feedback": final_state.get("critique_feedback", ""),
            },
            "iteration_count": final_state.get("iteration_count", 0),
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
            Command(resume=decision),
            config=config,
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
        prompt_set = VisualPromptSet.model_validate(visual_prompts_dict) if visual_prompts_dict else None

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

        # Cleanup checkpoints after terminal state
        await self.cleanup_checkpoints(thread_id)

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {
                "confidence_score": final_state.get("critique_score", 0.0),
                "feedback": final_state.get("critique_feedback", ""),
            },
        }

    async def cleanup_checkpoints(self, thread_id: str) -> None:
        """Delete checkpoint data for a completed thread."""
        if self._checkpointer is None:
            return
        try:
            async with self._checkpointer.conn.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("DELETE FROM checkpoint_writes WHERE thread_id = %s", (thread_id,))
                    await cur.execute("DELETE FROM checkpoints WHERE thread_id = %s", (thread_id,))
                await conn.commit()
            await logger.ainfo("checkpoints_cleaned", thread_id=thread_id)
        except Exception:
            await logger.aexception("checkpoint_cleanup_failed", thread_id=thread_id)
