"""Visual prompt extraction agent — turns scripts into image-generation prompts."""

from __future__ import annotations

import json
from enum import StrEnum

import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from ..providers.base import LLMProvider
from .script_generator import GeneratedScript

logger = structlog.get_logger(__name__)


class SceneCountError(ValueError):
    """Raised when extract_prompts() returns the wrong number of visual prompts."""


class VisualStyle(StrEnum):
    """Supported visual generation styles."""

    cinematic = "cinematic"
    anime = "anime"
    realistic = "realistic"
    cartoon = "cartoon"
    minimal = "minimal"


class VisualPrompt(BaseModel):
    """A single scene's image-generation prompt."""

    scene_number: int = Field(..., description="Sequential scene number")
    description: str = Field(..., description="Positive prompt for the image generator")
    style: str = Field(..., description="Visual style keyword")
    camera_angle: str = Field(..., description="Camera angle / shot type")
    mood: str = Field(..., description="Overall mood of the scene")
    negative_prompt: str = Field(
        default="",
        description="Negative prompt for quality control",
    )


class VisualPromptSet(BaseModel):
    """Complete set of visual prompts derived from a script."""

    prompts: list[VisualPrompt] = Field(default_factory=list)
    style_guide: str = Field(
        default="",
        description="Global style notes for visual consistency",
    )


_SYSTEM_PROMPT = """\
You are an expert visual director who converts short-form video scripts into \
image-generation prompts compatible with Stable Diffusion and Flux models.

Style: {style}

Rules:
- You will receive a numbered scene list. Produce EXACTLY one prompt per scene — \
no more, no fewer.
- Scene 1 is always the HOOK (attention-grabbing opener).
- The last scene is always the CTA (call-to-action, brand mark).
- Middle scenes are BODY (informational content).
- Each prompt must include: description, style, camera_angle, mood, and \
negative_prompt.
- Descriptions should be detailed, comma-separated keyword phrases suitable for \
Stable Diffusion (e.g. "close-up portrait, soft rim lighting, bokeh background").
- Negative prompts should exclude artefacts: "blurry, low quality, watermark, \
text, deformed, extra limbs".
- Keep a consistent visual style across all scenes.

IMPORTANT: Respond ONLY with valid JSON matching this schema — no markdown, \
no commentary:
{{
  "style_guide": "brief global style notes",
  "prompts": [
    {{
      "scene_number": 1,
      "description": "...",
      "style": "...",
      "camera_angle": "...",
      "mood": "...",
      "negative_prompt": "..."
    }}
  ]
}}
"""

_USER_PROMPT = """\
Generate one visual prompt per scene for the following short-form video script.

SCENES:
{scenes}
"""


class VisualPrompter:
    """Extracts image-generation prompts from a GeneratedScript."""

    def __init__(self, llm_provider: LLMProvider) -> None:
        self._llm = llm_provider

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def extract_prompts(
        self,
        script: GeneratedScript,
        style: str = "cinematic",
    ) -> VisualPromptSet:
        """Generate image prompts for every visual cue in *script*."""
        # Validate style
        try:
            VisualStyle(style)
        except ValueError:
            style = VisualStyle.cinematic.value

        system_prompt = _SYSTEM_PROMPT.format(style=style)

        # Build the explicit scene list: hook (1) + body cues (N) + CTA (1) = N+2 total.
        # We construct this ourselves so the LLM cannot miscount.
        body_cues = script.visual_cues or []
        scenes: list[str] = [f"Scene 1 [HOOK]: {script.hook}"]
        for i, cue in enumerate(body_cues, start=2):
            scenes.append(f"Scene {i} [BODY]: {cue}")
        scenes.append(f"Scene {len(body_cues) + 2} [CTA]: {script.cta}")
        total_scenes = len(scenes)

        user_prompt = _USER_PROMPT.format(scenes="\n".join(scenes))

        await logger.ainfo(
            "extracting_visual_prompts",
            style=style,
            scene_count=total_scenes,
        )

        response = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.6,
            max_tokens=2048,
        )

        prompt_set = self._parse_response(response.content)

        await logger.ainfo(
            "visual_prompts_extracted",
            prompt_count=len(prompt_set.prompts),
        )

        return prompt_set

    @staticmethod
    def _parse_response(raw: str) -> VisualPromptSet:
        """Extract JSON from the LLM response and validate it."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return VisualPromptSet.model_validate(data)
