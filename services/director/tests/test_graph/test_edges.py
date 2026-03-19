"""Tests for conditional edge routing functions."""

from __future__ import annotations

import uuid

from langgraph.graph import END
from src.graph.edges import (
    route_after_analyst,
    route_after_analyst_hitl,
    route_after_creator,
    route_after_strategist,
)
from src.graph.state import OrionState, PipelineStage


class TestRouteAfterStrategist:
    def test_routes_to_creator_on_success(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
            "script_hook": "hook",
            "script_body": "body",
            "script_cta": "cta",
            "visual_cues": [],
            "critique_score": 0.8,
            "critique_feedback": "good",
        }
        assert route_after_strategist(state) == "creator"

    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED,
            "error": "something broke",
        }
        assert route_after_strategist(state) == END


class TestRouteAfterCreator:
    """After Sprint 7, route_after_creator routes to analyst, not END."""

    def test_routes_to_analyst_on_success(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "visual_prompts": {"prompts": []},
        }
        assert route_after_creator(state) == "analyst"

    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED,
            "error": "failed",
        }
        assert route_after_creator(state) == END


class TestRouteAfterAnalyst:
    def test_routes_to_end(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
        }
        assert route_after_analyst(state) == END


class TestRouteAfterAnalystHitl:
    def test_routes_to_end_on_failure(self) -> None:
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
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_end_on_no_decisions(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
        }
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_end_on_rejection(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": False, "feedback": "no"}],
        }
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_strategist_on_approval_under_limit(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
            "iteration_count": 1,
            "max_iterations": 3,
        }
        assert route_after_analyst_hitl(state) == "strategist"

    def test_routes_to_end_on_approval_at_limit(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
            "iteration_count": 3,
            "max_iterations": 3,
        }
        assert route_after_analyst_hitl(state) == END
