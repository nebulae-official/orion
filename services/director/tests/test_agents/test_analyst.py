"""Tests for AnalystAgent."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from src.agents.analyst import AnalysisResult, AnalystAgent
from src.providers.base import LLMProvider, LLMResponse

ANALYSIS_JSON = json.dumps({
    "performance_summary": "Pipeline completed in 45s. Critique score 0.85 is above average.",
    "benchmark_comparison": {
        "avg_duration_seconds": 50,
        "avg_critique_score": 0.75,
        "percentile_rank": 80,
    },
    "suggestions": [
        {
            "area": "hook",
            "suggestion": "Use a question format for higher engagement",
            "expected_impact": "high",
            "rationale": "Questions in hooks increase retention by 20%",
        }
    ],
    "overall_score": 0.82,
})


class FakeAnalystLLM(LLMProvider):
    def __init__(self, response: str = ANALYSIS_JSON) -> None:
        self._response = response

    async def generate(self, prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
        return LLMResponse(content=self._response, model="fake")

    async def is_available(self) -> bool:
        return True


class TestAnalystAgent:
    @pytest.mark.asyncio
    async def test_analyze_returns_analysis_result(self) -> None:
        llm = FakeAnalystLLM()
        agent = AnalystAgent(llm)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        result = await agent.analyze(
            session=mock_session,
            content_id=uuid.uuid4(),
            niche="technology",
            script_hook="AI just changed everything",
            script_body="A breakthrough in AI...",
            critique_score=0.85,
        )

        assert isinstance(result, AnalysisResult)
        assert result.overall_score == 0.82
        assert len(result.suggestions) == 1
        assert result.suggestions[0].area == "hook"
        assert result.suggestions[0].expected_impact == "high"

    @pytest.mark.asyncio
    async def test_analyze_handles_llm_failure(self) -> None:
        bad_llm = AsyncMock(spec=LLMProvider)
        bad_llm.generate.side_effect = RuntimeError("LLM down")

        agent = AnalystAgent(bad_llm)
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        with pytest.raises(RuntimeError, match="LLM down"):
            await agent.analyze(
                session=mock_session,
                content_id=uuid.uuid4(),
                niche="technology",
                script_hook="hook",
                script_body="body",
                critique_score=0.5,
            )
