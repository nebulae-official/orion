"""H-V-C (Hook-Visual-CTA) script generation agent."""

from __future__ import annotations

import json
from enum import Enum

import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from ..providers.base import LLMProvider

logger = structlog.get_logger(__name__)


class TargetPlatform(str, Enum):
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


class ScriptGenerator:
    """Generates H-V-C scripts using the configured LLM provider."""

    def __init__(self, llm_provider: LLMProvider) -> None:
        self._llm = llm_provider

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
