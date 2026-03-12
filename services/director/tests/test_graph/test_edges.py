"""Tests for conditional edge routing functions."""

from __future__ import annotations

import uuid

from langgraph.graph import END

from src.graph.edges import route_after_strategist, route_after_creator
from src.graph.state import OrionState, PipelineStage


class TestRouteAfterStrategist:
    def test_routes_to_creator_on_success(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
            "script_hook": "hook", "script_body": "body", "script_cta": "cta",
            "visual_cues": [], "critique_score": 0.8, "critique_feedback": "good",
        }
        assert route_after_strategist(state) == "creator"

    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED, "error": "something broke",
        }
        assert route_after_strategist(state) == END


class TestRouteAfterCreator:
    def test_routes_to_end_on_success(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE, "visual_prompts": {"prompts": []},
        }
        assert route_after_creator(state) == END

    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED, "error": "visual extraction failed",
        }
        assert route_after_creator(state) == END
