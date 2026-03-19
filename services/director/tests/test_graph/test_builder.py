"""Tests for the graph builder factory."""

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.state import CompiledStateGraph
from src.graph.builder import build_content_graph


class TestBuildContentGraph:
    def test_build_returns_compiled_graph(self, fake_llm) -> None:
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.script_generator import ScriptGenerator
        from src.agents.visual_prompter import VisualPrompter

        script_gen = ScriptGenerator(fake_llm)
        critique_agent = CritiqueAgent(fake_llm, script_gen)
        visual_prompter = VisualPrompter(fake_llm)

        graph = build_content_graph(
            script_generator=script_gen,
            critique_agent=critique_agent,
            visual_prompter=visual_prompter,
        )
        assert isinstance(graph, CompiledStateGraph)

    def test_graph_has_expected_nodes(self, fake_llm) -> None:
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.script_generator import ScriptGenerator
        from src.agents.visual_prompter import VisualPrompter

        script_gen = ScriptGenerator(fake_llm)
        critique_agent = CritiqueAgent(fake_llm, script_gen)
        visual_prompter = VisualPrompter(fake_llm)

        graph = build_content_graph(
            script_generator=script_gen,
            critique_agent=critique_agent,
            visual_prompter=visual_prompter,
        )
        node_names = set(graph.nodes.keys())
        assert "strategist" in node_names
        assert "creator" in node_names


class TestBuildContentGraphWithHITL:
    def test_hitl_graph_has_review_nodes(self, fake_llm) -> None:
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.script_generator import ScriptGenerator
        from src.agents.visual_prompter import VisualPrompter

        script_gen = ScriptGenerator(fake_llm)
        critique_agent = CritiqueAgent(fake_llm, script_gen)
        visual_prompter = VisualPrompter(fake_llm)

        graph = build_content_graph(
            script_generator=script_gen,
            critique_agent=critique_agent,
            visual_prompter=visual_prompter,
            checkpointer=MemorySaver(),
            enable_hitl=True,
        )
        node_names = set(graph.nodes.keys())
        assert "strategist" in node_names
        assert "strategist_review" in node_names
        assert "creator" in node_names
        assert "creator_review" in node_names


class TestBuildContentGraphWithAnalyst:
    """Graph builder includes analyst node when analyst_agent is provided."""

    def test_non_hitl_graph_includes_analyst(self, fake_llm) -> None:
        from contextlib import asynccontextmanager
        from unittest.mock import AsyncMock

        from src.agents.analyst import AnalystAgent
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.script_generator import ScriptGenerator
        from src.agents.visual_prompter import VisualPrompter
        from src.graph.builder import build_content_graph

        script_gen = ScriptGenerator(fake_llm)

        @asynccontextmanager
        async def mock_session_factory():
            yield AsyncMock()

        graph = build_content_graph(
            script_generator=script_gen,
            critique_agent=CritiqueAgent(fake_llm, script_gen),
            visual_prompter=VisualPrompter(fake_llm),
            analyst_agent=AnalystAgent(fake_llm),
            session_factory=mock_session_factory,
        )

        node_names = set(graph.nodes.keys())
        assert "strategist" in node_names
        assert "creator" in node_names
        assert "analyst" in node_names
