"""Tests for the graph builder factory."""

from __future__ import annotations

import pytest
from langgraph.graph.state import CompiledStateGraph

from src.graph.builder import build_content_graph
from src.graph.state import PipelineStage


class TestBuildContentGraph:
    def test_build_returns_compiled_graph(self, fake_llm) -> None:
        from src.agents.script_generator import ScriptGenerator
        from src.agents.critique_agent import CritiqueAgent
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
        from src.agents.script_generator import ScriptGenerator
        from src.agents.critique_agent import CritiqueAgent
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


from langgraph.checkpoint.memory import MemorySaver


class TestBuildContentGraphWithHITL:
    def test_hitl_graph_has_review_nodes(self, fake_llm) -> None:
        from src.agents.script_generator import ScriptGenerator
        from src.agents.critique_agent import CritiqueAgent
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
