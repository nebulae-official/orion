# Sprint 6: LangGraph Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Director service's custom `ContentPipeline` to a LangGraph `StateGraph`, introducing durable state, conditional routing, and human-in-the-loop (HITL) interrupt gates at each node transition.

**Architecture:** The existing sequential pipeline (ScriptGenerator → CritiqueAgent → VisualPrompter) becomes a LangGraph `StateGraph` with two core nodes (strategist, creator) connected by conditional edges, plus optional HITL gate nodes (strategist_review, creator_review). The analyst node is deferred to a future sprint. HITL gates use LangGraph's `interrupt()` function at node boundaries. State is checkpointed to PostgreSQL via `AsyncPostgresSaver`. Existing agent classes are reused as-is inside graph nodes — they are not rewritten.

**Tech Stack:** LangGraph 0.2.x, langgraph-checkpoint-postgres, psycopg[binary], Python 3.13, FastAPI, Pydantic v2, structlog, pytest, pytest-asyncio

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `services/director/pyproject.toml` | Add langgraph + checkpoint deps |
| Create | `services/director/src/graph/__init__.py` | Package init |
| Create | `services/director/src/graph/state.py` | `OrionState` TypedDict definition |
| Create | `services/director/src/graph/nodes.py` | Strategist, creator, analyst node functions |
| Create | `services/director/src/graph/edges.py` | Conditional edge routing functions |
| Create | `services/director/src/graph/builder.py` | `build_content_graph()` factory |
| Create | `services/director/src/graph/hitl.py` | HITL interrupt gate helpers |
| Modify | `services/director/src/services/pipeline.py` | Replace sequential orchestration with graph invocation |
| Modify | `services/director/src/main.py` | Initialize checkpointer + graph in lifespan |
| Modify | `services/director/src/routes/content.py` | Add HITL resume endpoint |
| Modify | `services/director/src/schemas.py` | Add HITL request/response schemas |
| Create | `services/director/tests/test_graph/__init__.py` | Test package init |
| Create | `services/director/tests/test_graph/test_state.py` | OrionState tests |
| Create | `services/director/tests/test_graph/test_nodes.py` | Node function tests |
| Create | `services/director/tests/test_graph/test_edges.py` | Edge routing tests |
| Create | `services/director/tests/test_graph/test_builder.py` | Graph compilation tests |
| Create | `services/director/tests/test_graph/test_hitl.py` | HITL interrupt tests |
| Create | `services/director/tests/test_graph/conftest.py` | Shared fixtures (mock LLM, state factories) |

---

## Chunk 1: ORION-72 — LangGraph Integration Setup + OrionState Schema

### Task 1: Add LangGraph Dependencies

**Files:**
- Modify: `services/director/pyproject.toml`

- [ ] **Step 1: Add langgraph dependencies to pyproject.toml**

```toml
[project]
name = "orion-director"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "pydantic>=2.10.0",
    "httpx>=0.28.0",
    "tenacity>=9.0.0",
    "orion-common @ file:../../libs/orion-common",
    "langgraph>=0.2.0,<0.3.0",
    "langgraph-checkpoint-postgres>=2.0.0",
    "psycopg[binary]>=3.1.0",
]
```

- [ ] **Step 2: Install dependencies**

Run: `cd services/director && pip install -e .`
Expected: All packages install successfully, including `langgraph`, `langgraph-checkpoint-postgres`, `psycopg`.

- [ ] **Step 3: Verify langgraph imports work**

Run: `cd services/director && python -c "from langgraph.graph import StateGraph, START, END; from langgraph.types import interrupt, Command; from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver; print('LangGraph imports OK')"`
Expected: `LangGraph imports OK`

- [ ] **Step 4: Commit**

```bash
git add services/director/pyproject.toml
git commit -m "feat(ORION-72): add langgraph and checkpoint-postgres dependencies"
```

---

### Task 2: Define OrionState TypedDict

**Files:**
- Create: `services/director/src/graph/__init__.py`
- Create: `services/director/src/graph/state.py`
- Create: `services/director/tests/test_graph/__init__.py`
- Create: `services/director/tests/test_graph/conftest.py`
- Create: `services/director/tests/test_graph/test_state.py`

- [ ] **Step 1: Create graph package init**

```python
# services/director/src/graph/__init__.py
"""LangGraph-based content creation pipeline."""
```

- [ ] **Step 2: Write the failing test for OrionState**

```python
# services/director/tests/test_graph/test_state.py
"""Tests for OrionState schema."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

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
```

- [ ] **Step 3: Create the test package init and conftest**

```python
# services/director/tests/test_graph/__init__.py
```

```python
# services/director/tests/test_graph/conftest.py
"""Shared fixtures for graph tests."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock

import pytest

from src.agents.script_generator import GeneratedScript, ScriptRequest
from src.agents.visual_prompter import VisualPromptSet
from src.graph.state import OrionState, PipelineStage
from src.providers.base import LLMProvider, LLMResponse


class FakeLLMProvider(LLMProvider):
    """Deterministic LLM provider for testing."""

    def __init__(self, response_content: str = '{"hook":"test","body":"test body","cta":"test cta","visual_cues":["scene 1"]}') -> None:
        self._response_content = response_content

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        return LLMResponse(content=self._response_content, model="fake-model")

    async def is_available(self) -> bool:
        return True


@pytest.fixture
def fake_llm() -> FakeLLMProvider:
    return FakeLLMProvider()


@pytest.fixture
def sample_script() -> GeneratedScript:
    return GeneratedScript(
        hook="You won't believe this AI breakthrough",
        body="A new AI model has just shattered every benchmark...",
        cta="Follow for daily AI updates",
        visual_cues=["futuristic lab", "neural network visualization", "excited scientist"],
    )


@pytest.fixture
def sample_state() -> OrionState:
    return {
        "content_id": uuid.uuid4(),
        "trend_id": uuid.uuid4(),
        "trend_topic": "AI coding assistants",
        "niche": "technology",
        "target_platform": "youtube_shorts",
        "tone": "informative and engaging",
        "visual_style": "cinematic",
        "current_stage": PipelineStage.STRATEGIST,
    }
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd services/director && python -m pytest tests/test_graph/test_state.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.graph'`

- [ ] **Step 5: Write OrionState implementation**

```python
# services/director/src/graph/state.py
"""OrionState — the shared state schema for the content creation graph."""

from __future__ import annotations

import operator
from enum import Enum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict


class PipelineStage(str, Enum):
    """Which node the pipeline is currently at."""

    STRATEGIST = "strategist"
    CREATOR = "creator"
    ANALYST = "analyst"
    COMPLETE = "complete"
    FAILED = "failed"


class HITLDecision(BaseModel):
    """Record of a human-in-the-loop approval or rejection."""

    stage: PipelineStage = Field(..., description="Stage where the decision was made")
    approved: bool = Field(..., description="Whether the human approved")
    feedback: str | None = Field(default=None, description="Optional rejection feedback")


class OrionState(TypedDict):
    """Shared state flowing through the LangGraph content pipeline.

    Required keys (total=True by default) are set at pipeline start.
    Optional keys use NotRequired and are populated by individual nodes.
    """

    # --- Required: set at pipeline start ---
    content_id: UUID
    trend_id: UUID
    trend_topic: str
    niche: str
    target_platform: str
    tone: str
    visual_style: str
    current_stage: PipelineStage

    # --- Strategist outputs (optional) ---
    script_hook: NotRequired[str]
    script_body: NotRequired[str]
    script_cta: NotRequired[str]
    visual_cues: NotRequired[list[str]]

    # --- Analyst outputs (optional) ---
    critique_score: NotRequired[float]
    critique_feedback: NotRequired[str]

    # --- Creator outputs (optional) ---
    visual_prompts: NotRequired[dict[str, Any]]

    # --- HITL tracking (accumulates via operator.add reducer) ---
    hitl_decisions: NotRequired[Annotated[list[dict[str, Any]], operator.add]]

    # --- Error tracking (optional) ---
    error: NotRequired[str | None]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/director && python -m pytest tests/test_graph/test_state.py -v`
Expected: All 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add services/director/src/graph/ services/director/tests/test_graph/
git commit -m "feat(ORION-72): define OrionState TypedDict and PipelineStage enum"
```

---

## Chunk 2: ORION-73 — Strategist Node + ORION-74 — Creator Node

### Task 3: Implement Strategist Node (Script Generation + Critique)

**Files:**
- Create: `services/director/src/graph/nodes.py`
- Create: `services/director/tests/test_graph/test_nodes.py`

The strategist node wraps the existing `ScriptGenerator` and `CritiqueAgent`. It reads `trend_topic`, `niche`, `tone`, and `target_platform` from state, runs script generation then critique, and writes the results back to state.

- [ ] **Step 1: Write the failing test for strategist_node**

```python
# services/director/tests/test_graph/test_nodes.py
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
        # Override fake LLM to return script JSON first, critique JSON second
        call_count = 0
        original_generate = fake_llm.generate

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && python -m pytest tests/test_graph/test_nodes.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.graph.nodes'`

- [ ] **Step 3: Implement strategist_node and creator_node**

```python
# services/director/src/graph/nodes.py
"""Graph node functions — thin wrappers around existing agent classes."""

from __future__ import annotations

from typing import Any

import structlog

from ..agents.critique_agent import CritiqueAgent
from ..agents.script_generator import GeneratedScript, ScriptGenerator, ScriptRequest
from ..agents.visual_prompter import VisualPrompter
from .state import OrionState, PipelineStage

logger = structlog.get_logger(__name__)


async def strategist_node(
    state: OrionState,
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
) -> dict[str, Any]:
    """Generate an H-V-C script and critique it.

    Reads trend/niche/tone/platform from state, runs the existing
    ScriptGenerator, then CritiqueAgent. Writes script fields +
    critique results back to state.
    """
    await logger.ainfo(
        "strategist_node_started",
        trend_topic=state["trend_topic"],
    )

    try:
        request = ScriptRequest(
            trend_topic=state["trend_topic"],
            niche=state.get("niche", "technology"),
            target_platform=state.get("target_platform", "youtube_shorts"),
            tone=state.get("tone", "informative and engaging"),
        )

        script: GeneratedScript = await script_generator.generate_script(request)

        # Run critique
        script, critique_result = await critique_agent.critique_and_refine(
            script=script,
            request=request,
        )

        await logger.ainfo(
            "strategist_node_completed",
            hook_length=len(script.hook.split()),
            critique_score=critique_result.confidence_score,
        )

        return {
            "script_hook": script.hook,
            "script_body": script.body,
            "script_cta": script.cta,
            "visual_cues": script.visual_cues,
            "critique_score": critique_result.confidence_score,
            "critique_feedback": critique_result.feedback,
            "current_stage": PipelineStage.CREATOR,
        }

    except Exception as exc:
        await logger.aexception("strategist_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }


async def creator_node(
    state: OrionState,
    *,
    visual_prompter: VisualPrompter,
) -> dict[str, Any]:
    """Extract visual prompts from the script produced by the strategist.

    Reads script_hook/body/cta/visual_cues from state, runs the existing
    VisualPrompter, writes visual_prompts back to state.
    """
    await logger.ainfo(
        "creator_node_started",
        content_id=str(state.get("content_id", "")),
    )

    try:
        # Reconstruct GeneratedScript from state fields
        script = GeneratedScript(
            hook=state["script_hook"],
            body=state["script_body"],
            cta=state["script_cta"],
            visual_cues=state.get("visual_cues", []),
        )

        prompt_set = await visual_prompter.extract_prompts(
            script,
            style=state.get("visual_style", "cinematic"),
        )

        await logger.ainfo(
            "creator_node_completed",
            prompt_count=len(prompt_set.prompts),
        )

        return {
            "visual_prompts": prompt_set.model_dump(),
            "current_stage": PipelineStage.COMPLETE,
        }

    except Exception as exc:
        await logger.aexception("creator_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && python -m pytest tests/test_graph/test_nodes.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/graph/nodes.py services/director/tests/test_graph/test_nodes.py
git commit -m "feat(ORION-73,ORION-74): implement strategist and creator graph nodes"
```

---

### Task 4: Implement Conditional Edge Routing

**Files:**
- Create: `services/director/src/graph/edges.py`
- Create: `services/director/tests/test_graph/test_edges.py`

Edge routing determines what happens after each node: proceed to the next node, go to END (on failure), or loop back (analyst → strategist for feedback cycle).

- [ ] **Step 1: Write the failing test for edge routing**

```python
# services/director/tests/test_graph/test_edges.py
"""Tests for conditional edge routing functions."""

from __future__ import annotations

import uuid

from langgraph.graph import END

from src.graph.edges import route_after_strategist, route_after_creator
from src.graph.state import OrionState, PipelineStage


class TestRouteAfterStrategist:
    """Route after strategist node completes."""

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
    """Route after creator node completes."""

    def test_routes_to_end_on_success(self) -> None:
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
        assert route_after_creator(state) == END

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
            "error": "visual extraction failed",
        }
        assert route_after_creator(state) == END
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && python -m pytest tests/test_graph/test_edges.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.graph.edges'`

- [ ] **Step 3: Implement edge routing functions**

```python
# services/director/src/graph/edges.py
"""Conditional edge routing for the content creation graph."""

from __future__ import annotations

from langgraph.graph import END

from .state import OrionState, PipelineStage


def route_after_strategist(state: OrionState) -> str:
    """Decide next node after the strategist.

    Routes to 'creator' on success, END on failure.
    """
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator"


def route_after_creator(state: OrionState) -> str:
    """Decide next node after the creator.

    Routes to END in all cases (success or failure).
    Future: could route to 'analyst' for performance feedback loop.
    """
    return END


def route_after_creator_hitl(state: OrionState) -> str:
    """Decide next node after creator when HITL is enabled.

    Routes to 'creator_review' on success, END on failure
    (so failed creator output skips the HITL review gate).
    """
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator_review"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && python -m pytest tests/test_graph/test_edges.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/graph/edges.py services/director/tests/test_graph/test_edges.py
git commit -m "feat(ORION-73,ORION-74): implement conditional edge routing functions"
```

---

### Task 5: Build the Graph (StateGraph Compilation)

**Files:**
- Create: `services/director/src/graph/builder.py`
- Create: `services/director/tests/test_graph/test_builder.py`

- [ ] **Step 1: Write the failing test for graph builder**

```python
# services/director/tests/test_graph/test_builder.py
"""Tests for the graph builder factory."""

from __future__ import annotations

import uuid

import pytest
from langgraph.graph.state import CompiledStateGraph

from src.graph.builder import build_content_graph
from src.graph.state import PipelineStage


class TestBuildContentGraph:
    """Verify graph compilation and structure."""

    def test_build_returns_compiled_graph(self, fake_llm) -> None:
        """build_content_graph should return a CompiledStateGraph."""
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
        """Graph should contain strategist and creator nodes."""
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && python -m pytest tests/test_graph/test_builder.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.graph.builder'`

- [ ] **Step 3: Implement graph builder**

```python
# services/director/src/graph/builder.py
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
) -> CompiledStateGraph:
    """Build and compile the LangGraph content creation pipeline.

    Args:
        script_generator: Existing ScriptGenerator instance.
        critique_agent: Existing CritiqueAgent instance.
        visual_prompter: Existing VisualPrompter instance.
        checkpointer: Optional checkpointer for state persistence (e.g. AsyncPostgresSaver).

    Returns:
        A compiled StateGraph ready for invocation.
    """
    workflow = StateGraph(OrionState)

    # Bind dependencies to node functions via partial
    workflow.add_node(
        "strategist",
        partial(
            strategist_node,
            script_generator=script_generator,
            critique_agent=critique_agent,
        ),
    )
    workflow.add_node(
        "creator",
        partial(creator_node, visual_prompter=visual_prompter),
    )

    # Edges
    workflow.add_edge(START, "strategist")
    workflow.add_conditional_edges("strategist", route_after_strategist)
    workflow.add_conditional_edges("creator", route_after_creator)

    return workflow.compile(checkpointer=checkpointer)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && python -m pytest tests/test_graph/test_builder.py -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Run ALL graph tests to confirm nothing is broken**

Run: `cd services/director && python -m pytest tests/test_graph/ -v`
Expected: All 11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add services/director/src/graph/builder.py services/director/tests/test_graph/test_builder.py
git commit -m "feat(ORION-73,ORION-74): implement StateGraph builder with strategist and creator nodes"
```

---

## Chunk 3: ORION-75 — HITL Interrupt Gates

### Task 6: Implement HITL Interrupt Helpers

**Files:**
- Create: `services/director/src/graph/hitl.py`
- Create: `services/director/tests/test_graph/test_hitl.py`
- Modify: `services/director/src/graph/nodes.py` — add interrupt calls
- Modify: `services/director/src/graph/builder.py` — add `interrupt_before` config

The HITL pattern: after each node produces output, the graph interrupts before the next node. The caller resumes with `Command(resume={"approved": True/False, "feedback": "..."})`. The interrupt payload contains the node's output for human review.

- [ ] **Step 1: Write the failing test for HITL helpers**

```python
# services/director/tests/test_graph/test_hitl.py
"""Tests for HITL interrupt gate helpers."""

from __future__ import annotations

import uuid

import pytest

from src.graph.hitl import build_strategist_review_payload, build_creator_review_payload
from src.graph.state import OrionState, PipelineStage


class TestStrategistReviewPayload:
    """Build the payload shown to humans after strategist completes."""

    def test_payload_contains_script_and_critique(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI coding",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.CREATOR,
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
    """Build the payload shown to humans after creator completes."""

    def test_payload_contains_visual_prompts(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI coding",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "script_hook": "hook",
            "script_body": "body",
            "script_cta": "cta",
            "visual_cues": ["scene 1"],
            "critique_score": 0.8,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && python -m pytest tests/test_graph/test_hitl.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.graph.hitl'`

- [ ] **Step 3: Implement HITL helpers**

```python
# services/director/src/graph/hitl.py
"""Human-in-the-loop interrupt gate helpers."""

from __future__ import annotations

from typing import Any

from .state import OrionState


def build_strategist_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after strategist.

    Returns a JSON-serializable dict shown to the reviewer,
    containing the generated script and critique scores.
    """
    return {
        "stage": "strategist",
        "instruction": "Review the generated script and critique. Approve to proceed to visual prompt extraction, or reject with feedback.",
        "script": {
            "hook": state.get("script_hook", ""),
            "body": state.get("script_body", ""),
            "cta": state.get("script_cta", ""),
            "visual_cues": state.get("visual_cues", []),
        },
        "critique": {
            "score": state.get("critique_score", 0.0),
            "feedback": state.get("critique_feedback", ""),
        },
    }


def build_creator_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after creator.

    Returns a JSON-serializable dict containing the visual prompts
    for the reviewer to approve or reject.
    """
    return {
        "stage": "creator",
        "instruction": "Review the visual prompts. Approve to finalise content, or reject with feedback.",
        "visual_prompts": state.get("visual_prompts", {}),
        "script_summary": {
            "hook": state.get("script_hook", ""),
            "cta": state.get("script_cta", ""),
        },
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && python -m pytest tests/test_graph/test_hitl.py -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/graph/hitl.py services/director/tests/test_graph/test_hitl.py
git commit -m "feat(ORION-75): implement HITL review payload builders"
```

---

### Task 7: Add Interrupt Gates to Nodes

**Files:**
- Modify: `services/director/src/graph/nodes.py` — add `interrupt()` calls after node logic
- Modify: `services/director/src/graph/builder.py` — wire HITL-enabled graph variant

The `interrupt()` function pauses execution and sends the review payload to the caller. When resumed via `Command(resume={"approved": True})`, the node returns its output. On rejection (`approved: False`), the node can re-run or fail.

- [ ] **Step 1: Update strategist_node to support optional HITL interrupt**

In `services/director/src/graph/nodes.py`, add interrupt support. The interrupt is called **after** the strategist produces output but **before** the creator starts. We implement this by adding a separate `strategist_hitl_gate` node.

Add the following imports to the TOP of `services/director/src/graph/nodes.py` (alongside existing imports):

```python
from langgraph.types import interrupt

from .hitl import build_strategist_review_payload, build_creator_review_payload
```

Then append these functions at the END of the file:

```python
async def strategist_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after strategist: pause for human review of the script.

    Sends the script + critique as the interrupt payload.
    On resume, expects {"approved": bool, "feedback": str | None}.
    If rejected, sets stage to FAILED with the feedback.
    """
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_strategist_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", True) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo(
            "strategist_hitl_rejected",
            feedback=feedback,
        )
        return {
            "current_stage": PipelineStage.FAILED,
            "error": f"HITL rejected at strategist: {feedback or 'no feedback'}",
            "hitl_decisions": [
                {"stage": "strategist", "approved": False, "feedback": feedback}
            ],
        }

    await logger.ainfo("strategist_hitl_approved")
    return {
        "hitl_decisions": [
            {"stage": "strategist", "approved": True, "feedback": None}
        ],
    }


async def creator_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after creator: pause for human review of visual prompts.

    Sends the visual prompts as the interrupt payload.
    On resume, expects {"approved": bool, "feedback": str | None}.
    If rejected, sets stage to FAILED.
    """
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_creator_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", True) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo(
            "creator_hitl_rejected",
            feedback=feedback,
        )
        return {
            "current_stage": PipelineStage.FAILED,
            "error": f"HITL rejected at creator: {feedback or 'no feedback'}",
            "hitl_decisions": [
                {"stage": "creator", "approved": False, "feedback": feedback}
            ],
        }

    await logger.ainfo("creator_hitl_approved")
    return {
        "hitl_decisions": [
            {"stage": "creator", "approved": True, "feedback": None}
        ],
    }
```

- [ ] **Step 2: Update builder to include HITL gate nodes**

```python
# Replace services/director/src/graph/builder.py with HITL-aware version

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
        enable_hitl: If True, adds interrupt gates between nodes for
            human-in-the-loop review. Requires a checkpointer.

    Returns:
        A compiled StateGraph ready for invocation.
    """
    workflow = StateGraph(OrionState)

    # Core nodes
    workflow.add_node(
        "strategist",
        partial(
            strategist_node,
            script_generator=script_generator,
            critique_agent=critique_agent,
        ),
    )
    workflow.add_node(
        "creator",
        partial(creator_node, visual_prompter=visual_prompter),
    )

    if enable_hitl:
        # Insert HITL gate nodes between core nodes
        workflow.add_node("strategist_review", strategist_hitl_gate)
        workflow.add_node("creator_review", creator_hitl_gate)

        # Flow: START -> strategist -> (fail? END : strategist_review)
        #   -> (rejected? END : creator) -> (fail? END : creator_review) -> END
        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges(
            "strategist",
            route_after_strategist,
            {"creator": "strategist_review", END: END},
        )
        workflow.add_conditional_edges(
            "strategist_review",
            route_after_strategist,
            {"creator": "creator", END: END},
        )
        workflow.add_conditional_edges(
            "creator",
            route_after_creator_hitl,
            {"creator_review": "creator_review", END: END},
        )
        workflow.add_edge("creator_review", END)
    else:
        # Simple flow without HITL
        workflow.add_edge(START, "strategist")
        workflow.add_conditional_edges("strategist", route_after_strategist)
        workflow.add_conditional_edges("creator", route_after_creator)

    return workflow.compile(checkpointer=checkpointer)
```

- [ ] **Step 3: Add HITL-enabled graph tests**

Append to `services/director/tests/test_graph/test_builder.py`:

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command


class TestBuildContentGraphWithHITL:
    """Verify HITL-enabled graph compilation and node presence."""

    def test_hitl_graph_has_review_nodes(self, fake_llm) -> None:
        """HITL graph should include strategist_review and creator_review nodes."""
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
```

Also add to `services/director/tests/test_graph/test_hitl.py`:

```python
import json
import uuid

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from src.graph.builder import build_content_graph
from src.graph.state import PipelineStage


class TestHITLInterruptFlow:
    """Integration test: graph pauses at HITL gates and resumes."""

    @pytest.mark.asyncio
    async def test_graph_interrupts_after_strategist(self, fake_llm) -> None:
        """With HITL enabled, graph should pause after strategist for review."""
        from src.agents.script_generator import ScriptGenerator
        from src.agents.critique_agent import CritiqueAgent
        from src.agents.visual_prompter import VisualPrompter
        from src.providers.base import LLMResponse

        call_count = 0

        async def smart_generate(prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
            nonlocal call_count
            call_count += 1
            if "Evaluate this short-form video script" in (prompt or ""):
                return LLMResponse(
                    content=json.dumps({
                        "hook_strength": 0.9,
                        "value_density": 0.8,
                        "cta_clarity": 0.7,
                        "feedback": "Good",
                    }),
                    model="fake",
                )
            elif "visual" in (system_prompt or "").lower():
                return LLMResponse(
                    content=json.dumps({
                        "style_guide": "cinematic",
                        "prompts": [{
                            "scene_number": 1,
                            "description": "test scene",
                            "style": "cinematic",
                            "camera_angle": "wide",
                            "mood": "epic",
                            "negative_prompt": "blurry",
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
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.STRATEGIST,
        }

        # First invoke — should interrupt at strategist_review
        result = await graph.ainvoke(initial_state, config=config)

        # The graph should have paused (interrupt returns incomplete state)
        # Resume with approval
        result = await graph.ainvoke(
            Command(resume={"approved": True}),
            config=config,
        )

        # After approving strategist, it should hit creator_review interrupt
        # Resume again to complete
        result = await graph.ainvoke(
            Command(resume={"approved": True}),
            config=config,
        )

        # Now the graph should be complete
        assert result.get("script_hook") is not None
        assert result.get("visual_prompts") is not None
```

- [ ] **Step 4: Run ALL graph tests**

Run: `cd services/director && python -m pytest tests/test_graph/ -v`
Expected: All tests PASS (including new HITL tests)

- [ ] **Step 5: Commit**

```bash
git add services/director/src/graph/nodes.py services/director/src/graph/builder.py services/director/src/graph/edges.py services/director/tests/test_graph/
git commit -m "feat(ORION-75): add HITL interrupt gates with integration tests"
```

---

## Chunk 4: Integration — Wire Graph into Service

### Task 8: Update ContentPipeline to Use Graph

**Files:**
- Modify: `services/director/src/services/pipeline.py`
- Modify: `services/director/src/main.py`

Replace the sequential orchestration in `ContentPipeline.run()` with graph invocation. The pipeline class becomes a thin wrapper that creates initial state, invokes the graph, and persists results.

- [ ] **Step 1: Update pipeline.py to use the graph**

```python
# Replace services/director/src/services/pipeline.py

"""Content creation pipeline — wraps the LangGraph StateGraph."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import ContentStatus, PipelineStatus
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from ..graph.state import OrionState, PipelineStage
from ..memory.vector_store import VectorMemory
from ..repositories.content_repo import ContentRepository

logger = structlog.get_logger(__name__)


class ContentPipeline:
    """Orchestrates content creation via a LangGraph StateGraph.

    The graph handles script generation (strategist), critique, and
    visual prompt extraction (creator). This class manages DB records,
    vector memory storage, and event publishing around the graph.
    """

    def __init__(
        self,
        graph: CompiledStateGraph,
        event_bus: EventBus,
        vector_memory: VectorMemory | None = None,
    ) -> None:
        self._graph = graph
        self._event_bus = event_bus
        self._vector_memory = vector_memory

    async def run(
        self,
        session: AsyncSession,
        *,
        trend_id: uuid.UUID,
        trend_topic: str,
        niche: str = "technology",
        target_platform: str = "youtube_shorts",
        tone: str = "informative and engaging",
        visual_style: str = "cinematic",
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute the content creation pipeline via LangGraph.

        Returns a dict with ``content_id``, ``script``, ``visual_prompts``,
        and ``critique``.
        """
        repo = ContentRepository(session)

        # 1. Create a draft content record
        content = await repo.create(
            trend_id=trend_id,
            title=f"Content for: {trend_topic}",
            status=ContentStatus.generating,
        )
        content_id = content.id

        await logger.ainfo(
            "pipeline_started",
            content_id=str(content_id),
            trend_topic=trend_topic,
        )

        # 2. Create pipeline run record
        pipeline_run = await repo.create_pipeline_run(content_id, stage="langgraph_pipeline")
        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.running)

        # 3. Build initial state
        initial_state: OrionState = {
            "content_id": content_id,
            "trend_id": trend_id,
            "trend_topic": trend_topic,
            "niche": niche,
            "target_platform": target_platform,
            "tone": tone,
            "visual_style": visual_style,
            "current_stage": PipelineStage.STRATEGIST,
        }

        # 4. Invoke the graph
        config = {}
        if thread_id:
            config = {"configurable": {"thread_id": thread_id}}

        try:
            final_state = await self._graph.ainvoke(initial_state, config=config or None)
        except Exception as exc:
            await repo.update_pipeline_run(
                pipeline_run.id, PipelineStatus.failed, error_message=str(exc)
            )
            await repo.update_status(content_id, ContentStatus.draft)
            await session.commit()
            raise

        # 5. Check for graph-level failure
        if final_state.get("current_stage") == PipelineStage.FAILED:
            error_msg = final_state.get("error", "Unknown graph error")
            await repo.update_pipeline_run(
                pipeline_run.id, PipelineStatus.failed, error_message=error_msg
            )
            await repo.update_status(content_id, ContentStatus.draft)
            await session.commit()
            raise RuntimeError(f"Pipeline failed: {error_msg}")

        await repo.update_pipeline_run(pipeline_run.id, PipelineStatus.completed)

        # 6. Persist results from final state
        from ..agents.script_generator import GeneratedScript
        from ..agents.visual_prompter import VisualPromptSet

        script = GeneratedScript(
            hook=final_state.get("script_hook", ""),
            body=final_state.get("script_body", ""),
            cta=final_state.get("script_cta", ""),
            visual_cues=final_state.get("visual_cues", []),
        )

        visual_prompts_dict = final_state.get("visual_prompts", {})
        prompt_set = VisualPromptSet.model_validate(visual_prompts_dict) if visual_prompts_dict else None

        critique_score = final_state.get("critique_score", 0.0)

        await repo.update_content(
            content_id,
            script_body=script.body,
            hook=script.hook,
            visual_prompts=visual_prompts_dict or None,
            status=ContentStatus.review,
        )
        await session.commit()

        # 7. Store in vector memory
        if self._vector_memory is not None:
            try:
                await self._vector_memory.store_hook(
                    hook_text=script.hook,
                    engagement_score=critique_score,
                    content_id=str(content_id),
                )
                await self._vector_memory.store_content(
                    script_text=script.body,
                    content_id=str(content_id),
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            except Exception:
                await logger.aexception(
                    "vector_memory_store_failed",
                    content_id=str(content_id),
                )

        # 8. Publish CONTENT_CREATED event
        await self._event_bus.publish(
            Channels.CONTENT_CREATED,
            {
                "content_id": str(content_id),
                "trend_id": str(trend_id),
                "title": content.title,
                "status": ContentStatus.review.value,
            },
        )

        await logger.ainfo(
            "pipeline_completed",
            content_id=str(content_id),
        )

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {"confidence_score": critique_score, "feedback": final_state.get("critique_feedback", "")},
        }
```

- [ ] **Step 2: Update main.py to build the graph in lifespan**

In `services/director/src/main.py`, replace `ContentPipeline(llm_provider, _event_bus, ...)` with graph construction:

Replace the pipeline initialization section (around lines 138–144) with:

```python
    # Build LangGraph content pipeline
    from .graph.builder import build_content_graph

    _graph = build_content_graph(
        script_generator=script_gen,
        critique_agent=CritiqueAgent(llm_provider, script_gen),
        visual_prompter=visual_prompter,
        enable_hitl=False,  # Enable once HITL endpoints are ready
    )

    # Initialise content pipeline (now wraps the graph)
    _pipeline = ContentPipeline(_graph, _event_bus, vector_memory=_vector_memory)
```

Also update the imports at the top of main.py — remove `CritiqueAgent` if not already imported, and add it:

```python
from .agents.critique_agent import CritiqueAgent
```

- [ ] **Step 3: Run the full test suite**

Run: `cd services/director && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add services/director/src/services/pipeline.py services/director/src/main.py
git commit -m "feat(ORION-72): wire LangGraph StateGraph into ContentPipeline and service lifespan"
```

---

### Task 9: Add HITL Resume Endpoint

**Files:**
- Modify: `services/director/src/schemas.py` — add HITL schemas
- Modify: `services/director/src/routes/content.py` — add resume endpoint

- [ ] **Step 1: Add HITL schemas**

Append to `services/director/src/schemas.py`:

```python
class HITLResumeRequest(BaseModel):
    """Payload to resume a paused HITL pipeline."""

    thread_id: str = Field(..., description="Thread ID of the paused graph execution")
    approved: bool = Field(..., description="Whether the human approves the current output")
    feedback: str | None = Field(default=None, description="Optional rejection feedback")


class HITLStatusResponse(BaseModel):
    """Response showing the current HITL interrupt state."""

    thread_id: str
    interrupted: bool
    stage: str | None = None
    review_payload: dict | None = None
```

- [ ] **Step 2: Add resume endpoint to routes**

Append to `services/director/src/routes/content.py`:

```python
from langgraph.types import Command

from ..schemas import HITLResumeRequest, HITLStatusResponse


@router.post("/resume", response_model=GenerateContentResponse, status_code=200)
async def resume_pipeline(
    request: HITLResumeRequest,
    session: AsyncSession = Depends(get_session),
):
    """Resume a paused HITL pipeline with human decision."""
    pipeline = _get_pipeline()

    await logger.ainfo(
        "hitl_resume_requested",
        thread_id=request.thread_id,
        approved=request.approved,
    )

    decision = {"approved": request.approved, "feedback": request.feedback}

    try:
        result = await pipeline.resume(
            session,
            thread_id=request.thread_id,
            decision=decision,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    script = result.get("script")
    visual_prompts = result.get("visual_prompts")

    repo = ContentRepository(session)
    content = await repo.get_by_id(result["content_id"])

    return GenerateContentResponse(
        content_id=content.id,
        trend_id=content.trend_id,
        title=content.title,
        status=content.status.value,
        script=ScriptResponse.from_generated(script) if script else None,
        visual_prompts=VisualPromptsResponse(
            style_guide=visual_prompts.style_guide,
            prompts=visual_prompts.prompts,
        ) if visual_prompts else None,
        created_at=content.created_at,
    )
```

- [ ] **Step 3: Add `resume` method to ContentPipeline**

Append to `services/director/src/services/pipeline.py` class:

```python
    async def resume(
        self,
        session: AsyncSession,
        *,
        thread_id: str,
        decision: dict,
    ) -> dict[str, Any]:
        """Resume a paused HITL pipeline with a human decision.

        Args:
            session: Async database session.
            thread_id: The thread ID of the paused execution.
            decision: Dict with 'approved' (bool) and optional 'feedback' (str).

        Returns:
            Same shape as run() — content_id, script, visual_prompts, critique.
        """
        from langgraph.types import Command

        config = {"configurable": {"thread_id": thread_id}}

        final_state = await self._graph.ainvoke(
            Command(resume=decision),
            config=config,
        )

        if final_state.get("current_stage") == PipelineStage.FAILED:
            raise RuntimeError(f"Pipeline failed: {final_state.get('error', 'Unknown')}")

        from ..agents.script_generator import GeneratedScript
        from ..agents.visual_prompter import VisualPromptSet

        script = GeneratedScript(
            hook=final_state.get("script_hook", ""),
            body=final_state.get("script_body", ""),
            cta=final_state.get("script_cta", ""),
            visual_cues=final_state.get("visual_cues", []),
        )

        visual_prompts_dict = final_state.get("visual_prompts", {})
        prompt_set = VisualPromptSet.model_validate(visual_prompts_dict) if visual_prompts_dict else None

        # Persist if not already persisted
        repo = ContentRepository(session)
        content_id = final_state.get("content_id")
        if content_id:
            await repo.update_content(
                content_id,
                script_body=script.body,
                hook=script.hook,
                visual_prompts=visual_prompts_dict or None,
                status=ContentStatus.review,
            )
            await session.commit()

        return {
            "content_id": content_id,
            "script": script,
            "visual_prompts": prompt_set,
            "critique": {
                "confidence_score": final_state.get("critique_score", 0.0),
                "feedback": final_state.get("critique_feedback", ""),
            },
        }
```

- [ ] **Step 4: Run the full test suite**

Run: `cd services/director && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/schemas.py services/director/src/routes/content.py services/director/src/services/pipeline.py
git commit -m "feat(ORION-75): add HITL resume endpoint and pipeline resume method"
```

---

### Task 10: Final Integration Test + Cleanup

**Files:**
- Modify: `services/director/src/graph/__init__.py` — export public API
- All test files

- [ ] **Step 1: Update graph package exports**

```python
# services/director/src/graph/__init__.py
"""LangGraph-based content creation pipeline."""

from .builder import build_content_graph
from .state import HITLDecision, OrionState, PipelineStage

__all__ = [
    "build_content_graph",
    "HITLDecision",
    "OrionState",
    "PipelineStage",
]
```

- [ ] **Step 2: Run full test suite**

Run: `cd services/director && python -m pytest tests/ -v --tb=short`
Expected: All tests PASS

- [ ] **Step 3: Run linting**

Run: `cd services/director && python -m ruff check src/ tests/`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 4: Final commit**

```bash
git add services/director/src/graph/__init__.py
git commit -m "chore(ORION-72): export graph package public API"
```

- [ ] **Step 5: Verify service starts**

Run: `cd services/director && python -c "from src.graph.builder import build_content_graph; print('Graph builder importable')"`
Expected: `Graph builder importable`
