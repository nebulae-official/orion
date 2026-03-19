"""Performance analysis and improvement suggestion agent."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from orion_common.db.models import Content, ContentStatus, PipelineRun, PipelineStatus
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from ..providers.base import LLMProvider

logger = structlog.get_logger(__name__)


class ImprovementSuggestion(BaseModel):
    """A single improvement suggestion from the analyst."""

    area: str = Field(description="Area of improvement: hook, body, cta, visuals")
    suggestion: str = Field(description="Specific actionable suggestion")
    expected_impact: str = Field(description="Expected impact: high, medium, low")
    rationale: str = Field(description="Why this improvement matters")


class AnalysisResult(BaseModel):
    """Full analysis result from the AnalystAgent."""

    performance_summary: str = Field(description="Summary of pipeline performance")
    benchmark_comparison: dict[str, Any] = Field(description="Comparison against recent content")
    suggestions: list[ImprovementSuggestion] = Field(description="Prioritized improvement suggestions")
    overall_score: float = Field(ge=0.0, le=1.0, description="Overall pipeline quality score")


_ANALYST_SYSTEM_PROMPT = """\
You are a performance analyst for an AI content creation pipeline. \
Given performance data and a content script, analyze the quality and suggest improvements.

Evaluate:
1. Pipeline performance (duration, success rate)
2. Content quality relative to benchmarks
3. Specific areas for improvement

IMPORTANT: Respond ONLY with valid JSON matching this schema:
{{
  "performance_summary": "...",
  "benchmark_comparison": {{
    "avg_duration_seconds": 0,
    "avg_critique_score": 0.0,
    "percentile_rank": 0
  }},
  "suggestions": [
    {{
      "area": "hook|body|cta|visuals",
      "suggestion": "...",
      "expected_impact": "high|medium|low",
      "rationale": "..."
    }}
  ],
  "overall_score": 0.0
}}
"""

_ANALYST_USER_PROMPT = """\
Analyze this content pipeline run:

SCRIPT HOOK: {hook}

SCRIPT BODY: {body}

CRITIQUE SCORE: {critique_score}

PIPELINE DURATION: {pipeline_duration}

BENCHMARK DATA (last 30 days, same niche):
- Completed content count: {benchmark_count}
- Average critique score: {avg_critique_score}
- Average pipeline duration: {avg_duration}

Provide a performance summary, benchmark comparison, and prioritized improvement suggestions.
"""


class AnalystAgent:
    """Analyzes pipeline performance and generates improvement suggestions.

    Queries shared PostgreSQL tables for performance data, then uses an LLM
    to generate structured analysis and recommendations.
    """

    def __init__(self, llm_provider: LLMProvider) -> None:
        self._llm = llm_provider

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def analyze(
        self,
        session: AsyncSession,
        content_id: UUID,
        niche: str,
        script_hook: str,
        script_body: str,
        critique_score: float,
    ) -> AnalysisResult:
        """Analyze pipeline performance and generate improvement suggestions."""
        pipeline_duration = await self._get_pipeline_duration(session, content_id)
        benchmark = await self._get_benchmarks(session, niche)

        user_prompt = _ANALYST_USER_PROMPT.format(
            hook=script_hook,
            body=script_body,
            critique_score=critique_score,
            pipeline_duration=(f"{pipeline_duration:.1f}s" if pipeline_duration else "N/A"),
            benchmark_count=benchmark["count"],
            avg_critique_score=f"{benchmark['avg_critique_score']:.2f}",
            avg_duration=(f"{benchmark['avg_duration']:.1f}s" if benchmark["avg_duration"] else "N/A"),
        )

        response = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=_ANALYST_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=1024,
        )

        result = self._parse_analysis(response.content)

        await logger.ainfo(
            "analyst_completed",
            content_id=str(content_id),
            overall_score=result.overall_score,
            suggestion_count=len(result.suggestions),
        )

        return result

    async def _get_pipeline_duration(self, session: AsyncSession, content_id: UUID) -> float | None:
        """Get total pipeline duration in seconds for this content."""
        stmt = select(PipelineRun).where(
            PipelineRun.content_id == content_id,
            PipelineRun.status == PipelineStatus.completed,
        )
        result = await session.execute(stmt)
        runs = result.scalars().all()

        if not runs:
            return None

        run = runs[-1]
        if run.completed_at and run.started_at:
            return (run.completed_at - run.started_at).total_seconds()
        return None

    async def _get_benchmarks(self, session: AsyncSession, niche: str) -> dict[str, Any]:
        """Get benchmark data for the same niche over the last 30 days."""
        cutoff = datetime.now(UTC) - timedelta(days=30)

        # Note: Content table has no `niche` column. We query all recent
        # completed content as a baseline.
        stmt = select(Content).where(
            Content.status == ContentStatus.review,
            Content.created_at >= cutoff,
        )
        result = await session.execute(stmt)
        recent_content = result.scalars().all()

        count = len(recent_content)

        content_ids = [c.id for c in recent_content]
        avg_duration: float | None = None
        if content_ids:
            run_stmt = select(PipelineRun).where(
                PipelineRun.content_id.in_(content_ids),
                PipelineRun.status == PipelineStatus.completed,
            )
            run_result = await session.execute(run_stmt)
            runs = run_result.scalars().all()

            durations = []
            for run in runs:
                if run.completed_at and run.started_at:
                    durations.append((run.completed_at - run.started_at).total_seconds())
            if durations:
                avg_duration = sum(durations) / len(durations)

        return {
            "count": count,
            "avg_critique_score": 0.0,  # Not stored on Content model — deferred
            "avg_duration": avg_duration,
        }

    @staticmethod
    def _parse_analysis(raw: str) -> AnalysisResult:
        """Parse the LLM analysis response into AnalysisResult."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return AnalysisResult.model_validate(data)
