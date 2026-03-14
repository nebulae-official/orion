"""Shared fixtures for graph tests."""

from __future__ import annotations

import uuid

import pytest
from src.agents.script_generator import GeneratedScript
from src.graph.state import OrionState, PipelineStage
from src.providers.base import LLMProvider, LLMResponse


class FakeLLMProvider(LLMProvider):
    """Deterministic LLM provider for testing."""

    def __init__(
        self,
        response_content: str = (
            '{"hook":"test","body":"test body",'
            '"cta":"test cta","visual_cues":["scene 1"]}'
        ),
    ) -> None:
        self._response_content = response_content

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        return LLMResponse(content=self._response_content, model="fake-model")

    async def is_available(self) -> bool:
        return True


@pytest.fixture
def fake_llm() -> FakeLLMProvider:
    return FakeLLMProvider()


@pytest.fixture
def sample_script() -> GeneratedScript:
    return GeneratedScript(
        hook="You won't believe this AI breakthrough",
        body="A new AI model has just shattered every benchmark...",
        cta="Follow for daily AI updates",
        visual_cues=["futuristic lab", "neural network visualization", "excited scientist"],
    )


@pytest.fixture
def sample_state() -> OrionState:
    return {
        "content_id": uuid.uuid4(),
        "trend_id": uuid.uuid4(),
        "trend_topic": "AI coding assistants",
        "niche": "technology",
        "target_platform": "youtube_shorts",
        "tone": "informative and engaging",
        "visual_style": "cinematic",
        "current_stage": PipelineStage.STRATEGIST,
        "iteration_count": 0,
        "max_iterations": 3,
    }
