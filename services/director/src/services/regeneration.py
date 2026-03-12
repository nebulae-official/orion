"""Content regeneration service with feedback incorporation."""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import ContentStatus, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from ..agents.script_generator import GeneratedScript, ScriptGenerator, ScriptRequest
from ..agents.visual_prompter import VisualPrompter
from ..repositories.content_repo import ContentRepository

logger = structlog.get_logger(__name__)

# Maximum number of regeneration attempts per content piece
MAX_REGENERATION_ATTEMPTS = 3


class RegenerationService:
    """Handles content regeneration when a piece is rejected with feedback.

    Tracks feedback history per content_id and incorporates rejection
    feedback into the regeneration prompt. Limits regeneration to a
    maximum number of attempts to prevent infinite loops.
    """

    def __init__(
        self,
        script_generator: ScriptGenerator,
        visual_prompter: VisualPrompter,
        event_bus: EventBus,
    ) -> None:
        self._script_gen = script_generator
        self._visual_prompter = visual_prompter
        self._event_bus = event_bus
        # In-memory feedback history: content_id -> list of feedback strings
        self._feedback_history: dict[str, list[str]] = {}

    def get_feedback_history(self, content_id: str) -> list[str]:
        """Return the feedback history for a content piece."""
        return self._feedback_history.get(content_id, [])

    def get_attempt_count(self, content_id: str) -> int:
        """Return the number of regeneration attempts for a content piece."""
        return len(self._feedback_history.get(content_id, []))

    async def regenerate(
        self,
        session: AsyncSession,
        *,
        content_id: str,
        feedback: str,
        trend_topic: str,
        niche: str = "technology",
        target_platform: str = "youtube_shorts",
        tone: str = "informative and engaging",
        visual_style: str = "cinematic",
    ) -> dict[str, Any] | None:
        """Regenerate content incorporating rejection feedback.

        Args:
            session: Async database session.
            content_id: ID of the rejected content piece.
            feedback: Rejection feedback text to incorporate.
            trend_topic: The original trend topic.
            niche: Content niche / vertical.
            target_platform: Target platform for the video.
            tone: Desired tone.
            visual_style: Visual generation style.

        Returns:
            Dict with content_id, script, and visual_prompts on success,
            or None if max attempts exceeded.
        """
        # Track feedback history
        if content_id not in self._feedback_history:
            self._feedback_history[content_id] = []

        attempt_count = len(self._feedback_history[content_id])
        if attempt_count >= MAX_REGENERATION_ATTEMPTS:
            await logger.awarning(
                "max_regeneration_attempts_reached",
                content_id=content_id,
                attempts=attempt_count,
            )
            return None

        self._feedback_history[content_id].append(feedback)
        attempt_count += 1

        await logger.ainfo(
            "regeneration_starting",
            content_id=content_id,
            attempt=attempt_count,
            feedback_preview=feedback[:100],
        )

        repo = ContentRepository(session)

        # Build an enriched prompt incorporating all feedback
        feedback_context = self._build_feedback_context(content_id)

        # Update status to generating
        content_uuid = uuid.UUID(content_id)
        await repo.update_status(content_uuid, ContentStatus.generating)

        # Create pipeline run for regeneration
        regen_run = await repo.create_pipeline_run(
            content_uuid, stage=f"regeneration_attempt_{attempt_count}"
        )
        await repo.update_pipeline_run(regen_run.id, PipelineStatus.running)

        try:
            # Build request with feedback-enriched tone
            enriched_tone = (
                f"{tone}. IMPORTANT FEEDBACK TO ADDRESS: {feedback_context}"
            )
            script_request = ScriptRequest(
                trend_topic=trend_topic,
                niche=niche,
                target_platform=target_platform,
                tone=enriched_tone,
            )

            script: GeneratedScript = await self._script_gen.generate_script(
                script_request
            )
            await repo.update_pipeline_run(regen_run.id, PipelineStatus.completed)
        except Exception as exc:
            await repo.update_pipeline_run(
                regen_run.id,
                PipelineStatus.failed,
                error_message=str(exc),
            )
            await repo.update_status(content_uuid, ContentStatus.draft)
            await session.commit()
            raise

        # Generate new visual prompts
        try:
            prompt_set = await self._visual_prompter.extract_prompts(
                script, style=visual_style
            )
        except Exception:
            await logger.aexception(
                "regeneration_visual_prompts_failed",
                content_id=content_id,
            )
            # Still save the script even if visual prompts fail
            await repo.update_content(
                content_uuid,
                script_body=script.body,
                hook=script.hook,
                status=ContentStatus.review,
            )
            await session.commit()
            return {
                "content_id": content_uuid,
                "script": script,
                "visual_prompts": None,
                "attempt": attempt_count,
            }

        # Persist everything
        visual_prompts_dict = prompt_set.model_dump()
        await repo.update_content(
            content_uuid,
            script_body=script.body,
            hook=script.hook,
            visual_prompts=visual_prompts_dict,
            status=ContentStatus.review,
        )
        await session.commit()

        # Publish content updated event
        await self._event_bus.publish(
            Channels.CONTENT_UPDATED,
            {
                "content_id": content_id,
                "status": ContentStatus.review.value,
                "regeneration_attempt": attempt_count,
            },
        )

        await logger.ainfo(
            "regeneration_completed",
            content_id=content_id,
            attempt=attempt_count,
        )

        return {
            "content_id": content_uuid,
            "script": script,
            "visual_prompts": prompt_set,
            "attempt": attempt_count,
        }

    def _build_feedback_context(self, content_id: str) -> str:
        """Build a combined feedback context from all past rejections.

        Args:
            content_id: The content piece ID.

        Returns:
            Formatted feedback string for prompt injection.
        """
        history = self._feedback_history.get(content_id, [])
        if not history:
            return ""

        if len(history) == 1:
            return history[0]

        lines: list[str] = []
        for i, fb in enumerate(history, 1):
            lines.append(f"Feedback #{i}: {fb}")
        return " | ".join(lines)
