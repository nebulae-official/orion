"""Tests for OrionState schema."""

from __future__ import annotations

import uuid

from src.graph.state import OrionState, PipelineStage, HITLDecision


class TestOrionState:
    """Verify OrionState TypedDict shape and defaults."""

    def test_minimal_state_creation(self) -> None:
        """OrionState can be created with only required fields."""
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI coding assistants",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative and engaging",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.STRATEGIST,
        }
        assert state["trend_topic"] == "AI coding assistants"
        assert state["current_stage"] == PipelineStage.STRATEGIST

    def test_full_state_creation(self) -> None:
        """OrionState can hold all fields including optional agent outputs."""
        content_id = uuid.uuid4()
        state: OrionState = {
            "content_id": content_id,
            "trend_id": uuid.uuid4(),
            "trend_topic": "quantum computing breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative and engaging",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
            "script_hook": "You won't believe this quantum leap",
            "script_body": "Quantum computers just solved...",
            "script_cta": "Follow for more science updates",
            "visual_cues": ["scene 1", "scene 2"],
            "critique_score": 0.85,
            "critique_feedback": "Strong hook, improve CTA",
            "visual_prompts": {"prompts": [], "style_guide": "cinematic"},
            "hitl_decisions": [],
            "error": None,
        }
        assert state["content_id"] == content_id
        assert state["critique_score"] == 0.85


class TestPipelineStage:
    """Verify PipelineStage enum values."""

    def test_all_stages_defined(self) -> None:
        assert PipelineStage.STRATEGIST == "strategist"
        assert PipelineStage.CREATOR == "creator"
        assert PipelineStage.ANALYST == "analyst"
        assert PipelineStage.COMPLETE == "complete"
        assert PipelineStage.FAILED == "failed"


class TestHITLDecision:
    """Verify HITLDecision model."""

    def test_hitl_decision_creation(self) -> None:
        decision = HITLDecision(
            stage=PipelineStage.STRATEGIST,
            approved=True,
            feedback=None,
        )
        assert decision.approved is True
        assert decision.stage == PipelineStage.STRATEGIST
        assert decision.feedback is None

    def test_hitl_decision_with_rejection_feedback(self) -> None:
        decision = HITLDecision(
            stage=PipelineStage.STRATEGIST,
            approved=False,
            feedback="Hook is too generic, needs more punch",
        )
        assert decision.approved is False
        assert "too generic" in decision.feedback
