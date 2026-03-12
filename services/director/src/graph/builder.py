"""Factory for building the content creation StateGraph."""

from __future__ import annotations

from functools import partial

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import ScriptGenerator
from ..agents.visual_prompter import VisualPrompter
from .edges import route_after_creator, route_after_creator_hitl, route_after_strategist
from .nodes import creator_hitl_gate, creator_node, strategist_hitl_gate, strategist_node
from .state import OrionState


def build_content_graph(
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
    visual_prompter: VisualPrompter,
    checkpointer: BaseCheckpointSaver | None = None,
    enable_hitl: bool = False,
) -> CompiledStateGraph:
    """Build and compile the LangGraph content creation pipeline.

    Args:
        script_generator: Existing ScriptGenerator instance.
        critique_agent: Existing CritiqueAgent instance.
        visual_prompter: Existing VisualPrompter instance.
        checkpointer: Optional checkpointer for state persistence.
        enable_hitl: If True, adds interrupt gates between nodes.
    """
    workflow = StateGraph(OrionState)

    workflow.add_node(
        "strategist",
        partial(strategist_node, script_generator=script_generator, critique_agent=critique_agent),
    )
    workflow.add_node(
        "creator",
        partial(creator_node, visual_prompter=visual_prompter),
    )

    if enable_hitl:
        workflow.add_node("strategist_review", strategist_hitl_gate)
        workflow.add_node("creator_review", creator_hitl_gate)

        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges(
            "strategist", route_after_strategist,
            {"creator": "strategist_review", END: END},
        )
        workflow.add_conditional_edges(
            "strategist_review", route_after_strategist,
            {"creator": "creator", END: END},
        )
        workflow.add_conditional_edges(
            "creator", route_after_creator_hitl,
            {"creator_review": "creator_review", END: END},
        )
        workflow.add_edge("creator_review", END)
    else:
        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges("strategist", route_after_strategist)
        workflow.add_conditional_edges("creator", route_after_creator)

    return workflow.compile(checkpointer=checkpointer)
