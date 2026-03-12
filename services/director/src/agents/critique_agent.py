"""Script critique and auto-refinement agent."""

from __future__ import annotations

import json

import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from ..providers.base import LLMProvider
from .script_generator import GeneratedScript, ScriptGenerator, ScriptRequest

logger = structlog.get_logger(__name__)

# Auto-refine threshold: scripts below this score trigger re-generation
REFINEMENT_THRESHOLD = 0.7

# Maximum number of refinement iterations
MAX_REFINEMENT_ITERATIONS = 2


class CritiqueScores(BaseModel):
    """Individual critique dimensions for a generated script."""

    hook_strength: float = Field(
        ge=0.0, le=1.0,
        description="How attention-grabbing the hook is (0-1)",
    )
    value_density: float = Field(
        ge=0.0, le=1.0,
        description="How much value is packed into the content (0-1)",
    )
    cta_clarity: float = Field(
        ge=0.0, le=1.0,
        description="How clear and actionable the CTA is (0-1)",
    )


class CritiqueResult(BaseModel):
    """Full critique result including scores and feedback."""

    scores: CritiqueScores
    confidence_score: float = Field(
        ge=0.0, le=1.0,
        description="Overall confidence score (weighted average of dimensions)",
    )
    feedback: str = Field(
        description="Specific feedback for improving the script",
    )
    iteration: int = Field(
        default=0,
        description="Which refinement iteration this critique is from",
    )


_CRITIQUE_SYSTEM_PROMPT = """\
You are an expert content critic evaluating short-form video scripts. \
Evaluate the script on three dimensions:

1. HOOK_STRENGTH (0.0-1.0): Is the hook attention-grabbing and scroll-stopping? \
   Does it create curiosity or urgency in 5-10 words?
2. VALUE_DENSITY (0.0-1.0): Does the body deliver genuine insight, education, \
   or entertainment? Is it concise without being shallow?
3. CTA_CLARITY (0.0-1.0): Is the call-to-action specific, clear, and motivating?

Also provide specific actionable feedback for improvement.

IMPORTANT: Respond ONLY with valid JSON matching this exact schema:
{{
  "hook_strength": 0.0,
  "value_density": 0.0,
  "cta_clarity": 0.0,
  "feedback": "..."
}}
"""

_CRITIQUE_USER_PROMPT = """\
Evaluate this short-form video script:

HOOK: {hook}

BODY: {body}

CTA: {cta}

Topic: {topic}
Niche: {niche}
"""


class CritiqueAgent:
    """Evaluates and optionally refines generated scripts.

    Scores each script on hook_strength, value_density, and cta_clarity.
    If the overall confidence_score falls below the threshold, the agent
    triggers auto-refinement up to a configurable number of iterations.
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        script_generator: ScriptGenerator,
        threshold: float = REFINEMENT_THRESHOLD,
        max_iterations: int = MAX_REFINEMENT_ITERATIONS,
    ) -> None:
        self._llm = llm_provider
        self._script_gen = script_generator
        self._threshold = threshold
        self._max_iterations = max_iterations

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def critique(
        self,
        script: GeneratedScript,
        topic: str,
        niche: str = "technology",
        iteration: int = 0,
    ) -> CritiqueResult:
        """Evaluate a generated script and return critique scores.

        Args:
            script: The script to evaluate.
            topic: The trend topic the script covers.
            niche: Content niche / vertical.
            iteration: Current refinement iteration number.

        Returns:
            CritiqueResult with dimension scores, confidence, and feedback.
        """
        user_prompt = _CRITIQUE_USER_PROMPT.format(
            hook=script.hook,
            body=script.body,
            cta=script.cta,
            topic=topic,
            niche=niche,
        )

        response = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=_CRITIQUE_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=512,
        )

        scores = self._parse_critique(response.content)

        # Compute overall confidence as weighted average
        confidence = (
            scores.hook_strength * 0.4
            + scores.value_density * 0.35
            + scores.cta_clarity * 0.25
        )

        result = CritiqueResult(
            scores=scores,
            confidence_score=round(confidence, 3),
            feedback=scores._feedback if hasattr(scores, "_feedback") else "",
            iteration=iteration,
        )

        await logger.ainfo(
            "script_critiqued",
            confidence_score=result.confidence_score,
            hook_strength=scores.hook_strength,
            value_density=scores.value_density,
            cta_clarity=scores.cta_clarity,
            iteration=iteration,
        )

        return result

    async def critique_and_refine(
        self,
        script: GeneratedScript,
        request: ScriptRequest,
    ) -> tuple[GeneratedScript, CritiqueResult]:
        """Critique a script and auto-refine if below threshold.

        Iteratively critiques and regenerates the script until it meets
        the confidence threshold or the maximum iteration count is reached.

        Args:
            script: The initial generated script.
            request: The original script request for regeneration.

        Returns:
            Tuple of (final script, final critique result).
        """
        current_script = script

        for iteration in range(self._max_iterations + 1):
            result = await self.critique(
                script=current_script,
                topic=request.trend_topic,
                niche=request.niche,
                iteration=iteration,
            )

            if result.confidence_score >= self._threshold:
                await logger.ainfo(
                    "script_passed_critique",
                    confidence_score=result.confidence_score,
                    iteration=iteration,
                )
                return current_script, result

            if iteration >= self._max_iterations:
                await logger.awarning(
                    "max_refinement_iterations_reached",
                    confidence_score=result.confidence_score,
                    max_iterations=self._max_iterations,
                )
                return current_script, result

            # Auto-refine: regenerate with feedback
            await logger.ainfo(
                "auto_refining_script",
                confidence_score=result.confidence_score,
                iteration=iteration,
                feedback=result.feedback[:100],
            )

            current_script = await self._script_gen.generate_script(request)

        return current_script, result  # type: ignore[possibly-undefined]

    @staticmethod
    def _parse_critique(raw: str) -> CritiqueScores:
        """Parse the LLM critique response into scores."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:cleaned.rfind("```")]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        # Extract feedback before validation (not part of CritiqueScores)
        feedback = data.pop("feedback", "")

        scores = CritiqueScores.model_validate(data)
        # Attach feedback as a private attr for the caller
        scores._feedback = feedback  # type: ignore[attr-defined]
        return scores
