"""Content creation pipeline — orchestrates script generation and visual prompts."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import ContentStatus, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import GeneratedScript, ScriptGenerator, ScriptRequest
from ..agents.visual_prompter import VisualPrompter, VisualPromptSet
from ..memory.vector_store import VectorMemory
from ..providers.base import LLMProvider
from ..repositories.content_repo import ContentRepository

logger = structlog.get_logger(__name__)


class ContentPipeline:
    """End-to-end pipeline: trend -> script -> critique -> visual prompts -> DB -> event."""

    def __init__(
        self,
        llm_provider: LLMProvider,
        event_bus: EventBus,
        vector_memory: VectorMemory | None = None,
    ) -> None:
        self._script_gen = ScriptGenerator(llm_provider, vector_memory=vector_memory)
        self._visual_prompter = VisualPrompter(llm_provider)
        self._critique_agent = CritiqueAgent(llm_provider, self._script_gen)
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
    ) -> dict[str, Any]:
        """Execute the full content creation pipeline.

        Returns a dict with ``content_id``, ``script``, ``visual_prompts``,
        and ``critique``.
        """
        repo = ContentRepository(session)

        # 1. Create a draft content record
        content = await repo.create(
            trend_id=trend_id,
            title=f"Content for: {trend_topic}",
            status=ContentStatus.generating,
        )
        content_id = content.id

        await logger.ainfo(
            "pipeline_started",
            content_id=str(content_id),
            trend_topic=trend_topic,
        )

        # 2. Script generation stage
        script_run = await repo.create_pipeline_run(content_id, stage="script_generation")
        await repo.update_pipeline_run(script_run.id, PipelineStatus.running)

        try:
            script_request = ScriptRequest(
                trend_topic=trend_topic,
                niche=niche,
                target_platform=target_platform,
                tone=tone,
            )
            script: GeneratedScript = await self._script_gen.generate_script(script_request)
            await repo.update_pipeline_run(script_run.id, PipelineStatus.completed)
        except Exception as exc:
            await repo.update_pipeline_run(
                script_run.id, PipelineStatus.failed, error_message=str(exc)
            )
            await repo.update_status(content_id, ContentStatus.draft)
            await session.commit()
            raise

        # 3. Critique and auto-refine stage
        critique_run = await repo.create_pipeline_run(content_id, stage="script_critique")
        await repo.update_pipeline_run(critique_run.id, PipelineStatus.running)

        critique_result = None
        try:
            script, critique_result = await self._critique_agent.critique_and_refine(
                script=script,
                request=script_request,
            )
            await repo.update_pipeline_run(critique_run.id, PipelineStatus.completed)
        except Exception as exc:
            await logger.aexception(
                "critique_stage_failed",
                content_id=str(content_id),
            )
            await repo.update_pipeline_run(
                critique_run.id, PipelineStatus.failed, error_message=str(exc)
            )
            # Continue with the uncritiqued script

        # 4. Visual prompt extraction stage
        visual_run = await repo.create_pipeline_run(content_id, stage="visual_prompt_extraction")
        await repo.update_pipeline_run(visual_run.id, PipelineStatus.running)

        try:
            prompt_set: VisualPromptSet = await self._visual_prompter.extract_prompts(
                script, style=visual_style
            )
            await repo.update_pipeline_run(visual_run.id, PipelineStatus.completed)
        except Exception as exc:
            await repo.update_pipeline_run(
                visual_run.id, PipelineStatus.failed, error_message=str(exc)
            )
            # Still save the script even if visual prompts fail
            await repo.update_content(
                content_id,
                script_body=script.body,
                hook=script.hook,
                status=ContentStatus.draft,
            )
            await session.commit()
            raise

        # 5. Persist everything
        visual_prompts_dict = prompt_set.model_dump()
        await repo.update_content(
            content_id,
            script_body=script.body,
            hook=script.hook,
            visual_prompts=visual_prompts_dict,
            status=ContentStatus.review,
        )
        await session.commit()

        # 6. Store hook embedding in vector memory for future few-shot examples
        if self._vector_memory is not None:
            try:
                await self._vector_memory.store_hook(
                    hook_text=script.hook,
                    engagement_score=critique_result.confidence_score if critique_result else 0.5,
                    content_id=str(content_id),
                )
                await self._vector_memory.store_content(
                    script_text=script.body,
                    content_id=str(content_id),
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            except Exception:
                await logger.aexception(
                    "vector_memory_store_failed",
                    content_id=str(content_id),
                )

        # 7. Publish CONTENT_CREATED event
        await self._event_bus.publish(
            Channels.CONTENT_CREATED,
            {
                "content_id": str(content_id),
                "trend_id": str(trend_id),
                "title": content.title,
                "status": ContentStatus.review.value,
            },
        )

        await logger.ainfo(
            "pipeline_completed",
            content_id=str(content_id),
        )

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": critique_result,
        }
