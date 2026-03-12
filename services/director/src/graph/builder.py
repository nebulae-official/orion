"""Factory for building the content creation StateGraph."""

from __future__ import annotations

from functools import partial

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import ScriptGenerator
from ..agents.visual_prompter import VisualPrompter
from .edges import route_after_creator, route_after_strategist
from .nodes import creator_node, strategist_node
from .state import OrionState


def build_content_graph(
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
    visual_prompter: VisualPrompter,
    checkpointer: BaseCheckpointSaver | None = None,
    enable_hitl: bool = False,
) -> CompiledStateGraph:
    """Build and compile the LangGraph content creation pipeline."""
    workflow = StateGraph(OrionState)

    workflow.add_node(
        "strategist",
        partial(strategist_node, script_generator=script_generator, critique_agent=critique_agent),
    )
    workflow.add_node(
        "creator",
        partial(creator_node, visual_prompter=visual_prompter),
    )

    if not enable_hitl:
        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges("strategist", route_after_strategist)
        workflow.add_conditional_edges("creator", route_after_creator)
    # HITL path will be added in Task 7

    return workflow.compile(checkpointer=checkpointer)
