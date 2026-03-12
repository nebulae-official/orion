"""Factory for building the content creation StateGraph."""

from __future__ import annotations

from collections.abc import Callable
from functools import partial

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from ..agents.analyst import AnalystAgent
from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import ScriptGenerator
from ..agents.visual_prompter import VisualPrompter
from .edges import (
    route_after_analyst,
    route_after_analyst_hitl,
    route_after_creator,
    route_after_creator_hitl,
    route_after_strategist,
)
from .nodes import (
    analyst_hitl_gate,
    analyst_node,
    creator_hitl_gate,
    creator_node,
    strategist_hitl_gate,
    strategist_node,
)
from .state import OrionState


def build_content_graph(
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
    visual_prompter: VisualPrompter,
    analyst_agent: AnalystAgent | None = None,
    session_factory: Callable | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    enable_hitl: bool = False,
) -> CompiledStateGraph:
    """Build and compile the LangGraph content creation pipeline.

    Args:
        script_generator: Existing ScriptGenerator instance.
        critique_agent: Existing CritiqueAgent instance.
        visual_prompter: Existing VisualPrompter instance.
        analyst_agent: Optional AnalystAgent instance for performance analysis.
        session_factory: Async context manager yielding AsyncSession (required if analyst_agent is set).
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

    has_analyst = analyst_agent is not None and session_factory is not None

    if has_analyst:
        workflow.add_node(
            "analyst",
            partial(analyst_node, analyst_agent=analyst_agent, session_factory=session_factory),
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

        if has_analyst:
            workflow.add_node("analyst_review", analyst_hitl_gate)

            workflow.add_conditional_edges(
                "creator", route_after_creator_hitl,
                {"creator_review": "creator_review", END: END},
            )
            workflow.add_conditional_edges(
                "creator_review", route_after_creator,
                {"analyst": "analyst", END: END},
            )
            workflow.add_edge("analyst", "analyst_review")
            workflow.add_conditional_edges(
                "analyst_review", route_after_analyst_hitl,
                {"strategist": "strategist", END: END},
            )
        else:
            workflow.add_conditional_edges(
                "creator", route_after_creator_hitl,
                {"creator_review": "creator_review", END: END},
            )
            workflow.add_edge("creator_review", END)
    else:
        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges("strategist", route_after_strategist)
        if has_analyst:
            workflow.add_conditional_edges("creator", route_after_creator)
            workflow.add_conditional_edges("analyst", route_after_analyst)
        else:
            workflow.add_edge("creator", END)

    return workflow.compile(checkpointer=checkpointer)
