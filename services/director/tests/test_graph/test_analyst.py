"""Tests for analyst node and HITL gate."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from src.agents.analyst import AnalystAgent
from src.graph.hitl import build_analyst_review_payload
from src.graph.nodes import analyst_hitl_gate, analyst_node
from src.graph.state import OrionState, PipelineStage

ANALYSIS_JSON = json.dumps({
    "performance_summary": "Pipeline completed successfully.",
    "benchmark_comparison": {"avg_duration_seconds": 50, "avg_critique_score": 0.75, "percentile_rank": 80},
    "suggestions": [
        {"area": "hook", "suggestion": "Use questions", "expected_impact": "high", "rationale": "Engagement"}
    ],
    "overall_score": 0.82,
})


@asynccontextmanager
async def fake_session_factory():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result
    yield mock_session


class TestAnalystNode:
    @pytest.mark.asyncio
    async def test_analyst_produces_analysis(self, fake_llm) -> None:
        fake_llm._response_content = ANALYSIS_JSON
        agent = AnalystAgent(fake_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.ANALYST,
            "script_hook": "AI just changed everything",
            "script_body": "A breakthrough in AI...",
            "script_cta": "Follow for more",
            "visual_cues": [],
            "critique_score": 0.85,
            "critique_feedback": "Strong hook",
            "visual_prompts": {},
        }

        result = await analyst_node(
            state,
            analyst_agent=agent,
            session_factory=fake_session_factory,
        )

        assert result["current_stage"] == PipelineStage.COMPLETE
        assert result["analyst_score"] == 0.82
        assert "performance_summary" in result
        assert len(result["improvement_suggestions"]) == 1

    @pytest.mark.asyncio
    async def test_analyst_sets_failed_on_error(self) -> None:
        bad_llm = AsyncMock()
        bad_llm.generate.side_effect = RuntimeError("LLM down")
        agent = AnalystAgent(bad_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.ANALYST,
            "script_hook": "hook",
            "script_body": "body",
            "script_cta": "cta",
            "visual_cues": [],
            "critique_score": 0.5,
            "critique_feedback": "ok",
            "visual_prompts": {},
        }

        result = await analyst_node(
            state,
            analyst_agent=agent,
            session_factory=fake_session_factory,
        )

        assert result["current_stage"] == PipelineStage.FAILED
        assert "LLM down" in result["error"]


class TestAnalystHitlGate:
    @pytest.mark.asyncio
    async def test_skips_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED,
        }
        result = await analyst_hitl_gate(state)
        assert result == {}


class TestBuildAnalystReviewPayload:
    def test_builds_payload(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "performance_summary": "Good run",
            "improvement_suggestions": [{"area": "hook", "suggestion": "shorter"}],
            "analyst_score": 0.82,
        }

        payload = build_analyst_review_payload(state)

        assert payload["stage"] == "analyst"
        assert payload["performance_summary"] == "Good run"
        assert payload["analyst_score"] == 0.82
        assert len(payload["improvement_suggestions"]) == 1
