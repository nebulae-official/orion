"""Tests for graph node functions."""

from __future__ import annotations

import json
import uuid

import pytest

from src.graph.nodes import strategist_node, creator_node
from src.graph.state import OrionState, PipelineStage
from src.agents.script_generator import ScriptGenerator
from src.agents.critique_agent import CritiqueAgent
from src.agents.visual_prompter import VisualPrompter


SCRIPT_JSON = json.dumps({
    "hook": "AI just changed everything",
    "body": "A breakthrough in artificial intelligence has...",
    "cta": "Follow for more AI news",
    "visual_cues": ["robot typing", "code on screen"],
})

CRITIQUE_JSON = json.dumps({
    "hook_strength": 0.9,
    "value_density": 0.8,
    "cta_clarity": 0.7,
    "feedback": "Strong hook, body could use more detail",
})

VISUAL_JSON = json.dumps({
    "style_guide": "cinematic dark tech",
    "prompts": [
        {
            "scene_number": 1,
            "description": "robot typing on keyboard, neon lighting",
            "style": "cinematic",
            "camera_angle": "close-up",
            "mood": "futuristic",
            "negative_prompt": "blurry, low quality",
        }
    ],
})


class TestStrategistNode:
    """Strategist node generates a script and critiques it."""

    @pytest.mark.asyncio
    async def test_strategist_produces_script_and_critique(
        self, fake_llm, sample_state
    ) -> None:
        """Strategist should populate script fields and critique score."""
        call_count = 0

        async def mock_generate(prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
            nonlocal call_count
            call_count += 1
            if call_count <= 1:
                from src.providers.base import LLMResponse
                return LLMResponse(content=SCRIPT_JSON, model="fake")
            else:
                from src.providers.base import LLMResponse
                return LLMResponse(content=CRITIQUE_JSON, model="fake")

        fake_llm.generate = mock_generate

        script_gen = ScriptGenerator(fake_llm)
        critique_agent = CritiqueAgent(fake_llm, script_gen)

        result = await strategist_node(
            sample_state,
            script_generator=script_gen,
            critique_agent=critique_agent,
        )

        assert "script_hook" in result
        assert "script_body" in result
        assert "script_cta" in result
        assert "visual_cues" in result
        assert result["current_stage"] == PipelineStage.CREATOR
        assert "critique_score" in result
        assert "critique_feedback" in result

    @pytest.mark.asyncio
    async def test_strategist_sets_failed_on_error(
        self, sample_state
    ) -> None:
        """If script generation fails, strategist sets error and FAILED stage."""
        from unittest.mock import AsyncMock
        from src.providers.base import LLMProvider

        bad_llm = AsyncMock(spec=LLMProvider)
        bad_llm.generate.side_effect = RuntimeError("LLM unreachable")

        script_gen = ScriptGenerator(bad_llm)
        critique_agent = CritiqueAgent(bad_llm, script_gen)

        result = await strategist_node(
            sample_state,
            script_generator=script_gen,
            critique_agent=critique_agent,
        )

        assert result["current_stage"] == PipelineStage.FAILED
        assert "LLM unreachable" in result["error"]


class TestCreatorNode:
    """Creator node extracts visual prompts from the script."""

    @pytest.mark.asyncio
    async def test_creator_produces_visual_prompts(self, fake_llm) -> None:
        """Creator should populate visual_prompts from script fields in state."""
        fake_llm._response_content = VISUAL_JSON
        visual_prompter = VisualPrompter(fake_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
            "script_hook": "AI just changed everything",
            "script_body": "A breakthrough in AI...",
            "script_cta": "Follow for more",
            "visual_cues": ["robot typing", "code on screen"],
            "critique_score": 0.85,
            "critique_feedback": "Strong hook",
        }

        result = await creator_node(state, visual_prompter=visual_prompter)

        assert "visual_prompts" in result
        assert result["current_stage"] == PipelineStage.COMPLETE
        assert result["visual_prompts"]["style_guide"] == "cinematic dark tech"

    @pytest.mark.asyncio
    async def test_creator_sets_failed_on_error(self) -> None:
        """If visual prompt extraction fails, creator sets error."""
        from unittest.mock import AsyncMock
        from src.providers.base import LLMProvider

        bad_llm = AsyncMock(spec=LLMProvider)
        bad_llm.generate.side_effect = RuntimeError("LLM down")

        visual_prompter = VisualPrompter(bad_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
            "script_hook": "Hook",
            "script_body": "Body",
            "script_cta": "CTA",
            "visual_cues": ["scene 1"],
            "critique_score": 0.8,
            "critique_feedback": "OK",
        }

        result = await creator_node(state, visual_prompter=visual_prompter)

        assert result["current_stage"] == PipelineStage.FAILED
        assert "LLM down" in result["error"]
