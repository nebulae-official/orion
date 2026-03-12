"""Tests for HITL interrupt gate helpers."""

from __future__ import annotations

import json
import uuid

import pytest

from src.graph.hitl import build_strategist_review_payload, build_creator_review_payload
from src.graph.state import OrionState, PipelineStage


class TestStrategistReviewPayload:
    def test_payload_contains_script_and_critique(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "AI coding", "niche": "technology",
            "target_platform": "youtube_shorts", "tone": "informative",
            "visual_style": "cinematic", "current_stage": PipelineStage.CREATOR,
            "script_hook": "AI is writing code now",
            "script_body": "In a stunning development...",
            "script_cta": "Follow for AI updates",
            "visual_cues": ["coding screen", "robot"],
            "critique_score": 0.82,
            "critique_feedback": "Good hook, CTA needs work",
        }
        payload = build_strategist_review_payload(state)
        assert payload["stage"] == "strategist"
        assert payload["script"]["hook"] == "AI is writing code now"
        assert payload["critique"]["score"] == 0.82
        assert "instruction" in payload


class TestCreatorReviewPayload:
    def test_payload_contains_visual_prompts(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "AI coding", "niche": "technology",
            "target_platform": "youtube_shorts", "tone": "informative",
            "visual_style": "cinematic", "current_stage": PipelineStage.COMPLETE,
            "script_hook": "hook", "script_body": "body", "script_cta": "cta",
            "visual_cues": ["scene 1"], "critique_score": 0.8,
            "critique_feedback": "ok",
            "visual_prompts": {
                "style_guide": "cinematic",
                "prompts": [{"scene_number": 1, "description": "robot"}],
            },
        }
        payload = build_creator_review_payload(state)
        assert payload["stage"] == "creator"
        assert payload["visual_prompts"]["style_guide"] == "cinematic"
        assert "instruction" in payload


class TestHITLInterruptFlow:
    @pytest.mark.asyncio
    async def test_graph_interrupts_and_resumes(self, fake_llm) -> None:
        """With HITL enabled, graph should pause and resume correctly."""
        from src.agents.script_generator import ScriptGenerator
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.visual_prompter import VisualPrompter
        from src.providers.base import LLMResponse

        from langgraph.checkpoint.memory import MemorySaver
        from langgraph.types import Command

        from src.graph.builder import build_content_graph

        async def smart_generate(prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
            if "Evaluate this short-form video script" in (prompt or ""):
                return LLMResponse(
                    content=json.dumps({
                        "hook_strength": 0.9, "value_density": 0.8,
                        "cta_clarity": 0.7, "feedback": "Good",
                    }),
                    model="fake",
                )
            elif "visual" in (system_prompt or "").lower():
                return LLMResponse(
                    content=json.dumps({
                        "style_guide": "cinematic",
                        "prompts": [{
                            "scene_number": 1, "description": "test scene",
                            "style": "cinematic", "camera_angle": "wide",
                            "mood": "epic", "negative_prompt": "blurry",
                        }],
                    }),
                    model="fake",
                )
            else:
                return LLMResponse(
                    content=json.dumps({
                        "hook": "AI changes everything",
                        "body": "Major breakthrough in AI...",
                        "cta": "Follow for updates",
                        "visual_cues": ["robot", "code"],
                    }),
                    model="fake",
                )

        fake_llm.generate = smart_generate

        script_gen = ScriptGenerator(fake_llm)
        critique_agent = CritiqueAgent(fake_llm, script_gen)
        visual_prompter = VisualPrompter(fake_llm)

        checkpointer = MemorySaver()
        graph = build_content_graph(
            script_generator=script_gen,
            critique_agent=critique_agent,
            visual_prompter=visual_prompter,
            checkpointer=checkpointer,
            enable_hitl=True,
        )

        config = {"configurable": {"thread_id": "test-hitl-1"}}
        initial_state = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs", "niche": "technology",
            "target_platform": "youtube_shorts", "tone": "informative",
            "visual_style": "cinematic", "current_stage": PipelineStage.STRATEGIST,
        }

        # First invoke — should interrupt at strategist_review
        result = await graph.ainvoke(initial_state, config=config)

        # Resume with approval — should hit creator_review interrupt
        result = await graph.ainvoke(
            Command(resume={"approved": True}), config=config,
        )

        # Resume again to complete
        result = await graph.ainvoke(
            Command(resume={"approved": True}), config=config,
        )

        # Now the graph should be complete
        assert result.get("script_hook") is not None
        assert result.get("visual_prompts") is not None
