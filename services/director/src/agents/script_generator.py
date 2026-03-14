"""H-V-C (Hook-Visual-CTA) script generation agent."""

from __future__ import annotations

import json
from enum import StrEnum

import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from ..memory.vector_store import VectorMemory
from ..providers.base import LLMProvider

logger = structlog.get_logger(__name__)


class TargetPlatform(StrEnum):
    """Supported short-form video platforms."""

    youtube_shorts = "youtube_shorts"
    tiktok = "tiktok"
    instagram_reels = "instagram_reels"


class ScriptRequest(BaseModel):
    """Input parameters for script generation."""

    trend_topic: str = Field(..., description="The trend topic to create content about")
    niche: str = Field(default="technology", description="Content niche / vertical")
    target_platform: TargetPlatform = Field(
        default=TargetPlatform.youtube_shorts,
        description="Target platform for the short-form video",
    )
    tone: str = Field(
        default="informative and engaging",
        description="Desired tone of the script",
    )


class GeneratedScript(BaseModel):
    """Structured H-V-C script output."""

    hook: str = Field(..., description="Attention-grabbing opener (5-10 words)")
    body: str = Field(..., description="Main content (100-200 words)")
    cta: str = Field(..., description="Call-to-action")
    visual_cues: list[str] = Field(
        default_factory=list,
        description="List of scene descriptions for visual production",
    )


_SYSTEM_PROMPT = """\
You are an expert short-form video scriptwriter specialising in the H-V-C \
(Hook-Visual-CTA) framework. You produce scripts that are punchy, \
scroll-stopping, and optimised for engagement on {platform}.

Rules:
- The HOOK must be 5-10 words that immediately grab attention.
- The BODY should be 100-200 words of concise, valuable content.
- The CTA must drive a specific viewer action (follow, comment, share, etc.).
- Include 3-6 VISUAL_CUES — brief scene descriptions a video editor can follow.
- Tone: {tone}

IMPORTANT: Respond ONLY with valid JSON matching this exact schema — no markdown, \
no commentary:
{{
  "hook": "...",
  "body": "...",
  "cta": "...",
  "visual_cues": ["scene 1", "scene 2", ...]
}}
"""

_USER_PROMPT = """\
Create an H-V-C short-form video script about the following trending topic.

Trend: {trend_topic}
Niche: {niche}
Platform: {platform}
"""

_FEW_SHOT_SECTION = """\

Here are examples of high-performing hooks from similar past content. \
Use them as inspiration but create something original:

{examples}
"""


class ScriptGenerator:
    """Generates H-V-C scripts using the configured LLM provider.

    Optionally uses a VectorMemory instance to retrieve similar past
    hooks as few-shot examples for improved script quality.
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        vector_memory: VectorMemory | None = None,
    ) -> None:
        self._llm = llm_provider
        self._vector_memory = vector_memory

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def generate_script(self, request: ScriptRequest) -> GeneratedScript:
        """Generate an H-V-C script for the given request."""
        platform_label = request.target_platform.value.replace("_", " ").title()

        system_prompt = _SYSTEM_PROMPT.format(
            platform=platform_label,
            tone=request.tone,
        )
        user_prompt = _USER_PROMPT.format(
            trend_topic=request.trend_topic,
            niche=request.niche,
            platform=platform_label,
        )

        # Enrich with few-shot examples from vector memory
        few_shot_text = await self._build_few_shot_examples(request.trend_topic)
        if few_shot_text:
            user_prompt += _FEW_SHOT_SECTION.format(examples=few_shot_text)

        await logger.ainfo(
            "generating_script",
            trend_topic=request.trend_topic,
            platform=platform_label,
        )

        response = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=1024,
        )

        script = self._parse_response(response.content)

        await logger.ainfo(
            "script_generated",
            hook_length=len(script.hook.split()),
            body_length=len(script.body.split()),
            visual_cues_count=len(script.visual_cues),
        )

        return script

    async def _build_few_shot_examples(self, trend_topic: str) -> str:
        """Retrieve similar hooks from vector memory as few-shot examples.

        Args:
            trend_topic: The topic to find similar hooks for.

        Returns:
            Formatted string of examples, or empty string if unavailable.
        """
        if self._vector_memory is None:
            return ""

        try:
            similar_hooks = await self._vector_memory.get_similar_hooks(
                query_text=trend_topic,
                top_k=3,
            )
            if not similar_hooks:
                return ""

            lines: list[str] = []
            for i, hook in enumerate(similar_hooks, 1):
                hook_text = hook.get("hook_text", "")
                score = hook.get("engagement_score", 0.0)
                lines.append(
                    f"{i}. \"{hook_text}\" (engagement: {score:.2f})"
                )

            await logger.ainfo(
                "few_shot_examples_loaded",
                count=len(similar_hooks),
                trend_topic=trend_topic,
            )
            return "\n".join(lines)
        except Exception:
            await logger.aexception("few_shot_retrieval_failed")
            return ""

    @staticmethod
    def _parse_response(raw: str) -> GeneratedScript:
        """Extract JSON from the LLM response and validate it."""
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            # Remove opening fence (```json or ```)
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return GeneratedScript.model_validate(data)
