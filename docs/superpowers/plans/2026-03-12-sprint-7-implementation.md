# Sprint 7: LangGraph Persistence, Feedback Loop & Cross-Cutting Concerns — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Director's LangGraph pipeline with PostgreSQL checkpointing, the Analyst node, a cyclic feedback loop, Gateway rate limiting, and Prometheus metrics across all services.

**Architecture:** Three-node LangGraph graph (Strategist → Creator → Analyst) with HITL gates, cyclic feedback loop (Analyst → Strategist), PostgreSQL persistence via AsyncPostgresSaver, Redis sliding window rate limiting on the Go Gateway, and Prometheus auto-instrumentation on all services.

**Tech Stack:** LangGraph 1.x, langgraph-checkpoint-postgres, psycopg, AsyncPostgresSaver, go-redis/v9, prometheus/client_golang, prometheus-fastapi-instrumentator, Chi v5 middleware

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `services/director/src/agents/analyst.py` | AnalystAgent class — performance analysis, benchmark comparison, improvement suggestions |
| `services/director/src/metrics.py` | Director custom Prometheus counters/histograms |
| `services/director/tests/test_graph/test_analyst.py` | Unit tests for analyst node, edge routing, HITL gate |
| `services/director/tests/test_agents/test_analyst.py` | Unit tests for AnalystAgent class |
| `internal/gateway/middleware/ratelimit.go` | Redis sliding window rate limiter middleware |
| `internal/gateway/middleware/ratelimit_test.go` | Rate limiter tests with miniredis |
| `internal/gateway/middleware/metrics.go` | Prometheus HTTP metrics middleware |
| `internal/gateway/middleware/metrics_test.go` | Metrics middleware tests |

### Modified Files
| File | Changes |
|------|---------|
| `services/director/src/graph/state.py` | Add analyst fields, iteration fields, fix comment |
| `services/director/src/graph/edges.py` | Update `route_after_creator`, add `route_after_analyst`, `route_after_analyst_hitl` |
| `services/director/src/graph/nodes.py` | Add `analyst_node`, `analyst_hitl_gate` |
| `services/director/src/graph/hitl.py` | Add `build_analyst_review_payload` |
| `services/director/src/graph/builder.py` | Add analyst node, analyst HITL gate, feedback loop, checkpointer |
| `services/director/src/services/pipeline.py` | Add thread_id, cleanup_checkpoints, iteration tracking, metrics |
| `services/director/src/main.py` | Initialize AsyncPostgresSaver, AnalystAgent, enable_hitl=True, instrument_app |
| `services/director/src/schemas.py` | Add thread_id to GenerateContentResponse |
| `services/director/tests/test_graph/conftest.py` | Add analyst fixtures, updated sample_state |
| `services/director/tests/test_graph/test_edges.py` | Update creator tests, add analyst edge tests |
| `libs/orion-common/orion_common/health.py` | Remove placeholder `/metrics`, add `instrument_app()` |
| `libs/orion-common/pyproject.toml` | Add prometheus-fastapi-instrumentator |
| `internal/gateway/router/router.go` | Replace flat proxy loop with per-service route groups + rate limiting |
| `internal/gateway/middleware/middleware.go` | (read-only reference) |
| `go.mod` / `go.sum` | Add go-redis/v9 and prometheus/client_golang |
| `pkg/config/config.go` | (read-only — RedisURL already present) |

---

## Chunk 1: ORION-76 — PostgreSQL Checkpointing + State Additions

### Task 1: Add Analyst & Iteration Fields to OrionState

**Files:**
- Modify: `services/director/src/graph/state.py`
- Test: `services/director/tests/test_graph/test_state.py`

- [ ] **Step 1: Write the failing test**

In `services/director/tests/test_graph/test_state.py`, add tests for the new fields:

```python
# Add to the existing test file

class TestOrionStateAnalystFields:
    """Analyst and iteration fields exist in OrionState."""

    def test_state_accepts_analyst_fields(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.STRATEGIST,
            "performance_summary": "Pipeline completed in 45s",
            "improvement_suggestions": [{"area": "hook", "suggestion": "shorter"}],
            "analyst_score": 0.85,
            "iteration_count": 1,
            "max_iterations": 3,
        }
        assert state["analyst_score"] == 0.85
        assert state["iteration_count"] == 1
        assert state["max_iterations"] == 3
        assert state["performance_summary"] == "Pipeline completed in 45s"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && uv run pytest tests/test_graph/test_state.py::TestOrionStateAnalystFields -v`
Expected: FAIL — `performance_summary`, `analyst_score`, `iteration_count`, `max_iterations` not in OrionState TypedDict

- [ ] **Step 3: Add analyst and iteration fields to OrionState**

In `services/director/src/graph/state.py`, add the new fields and fix the misleading comment:

```python
    # --- Critique outputs (optional) ---          # <-- rename from "Analyst outputs"
    critique_score: NotRequired[float]
    critique_feedback: NotRequired[str]

    # --- Creator outputs (optional) ---
    visual_prompts: NotRequired[dict[str, Any]]

    # --- Analyst outputs (optional) ---
    performance_summary: NotRequired[str]
    improvement_suggestions: NotRequired[list[dict[str, Any]]]
    analyst_score: NotRequired[float]

    # --- Feedback loop tracking ---
    iteration_count: NotRequired[int]
    max_iterations: NotRequired[int]

    # --- HITL tracking (accumulates via operator.add reducer) ---
    hitl_decisions: NotRequired[Annotated[list[dict[str, Any]], operator.add]]

    # --- Error tracking (optional) ---
    error: NotRequired[str | None]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && uv run pytest tests/test_graph/test_state.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/graph/state.py services/director/tests/test_graph/test_state.py
git commit -m "feat(ORION-76): add analyst and iteration fields to OrionState"
```

---

### Task 2: Initialize AsyncPostgresSaver in Director Lifespan

**Files:**
- Modify: `services/director/src/main.py`
- Test: Manual verification (lifespan integration — tested end-to-end in Task 5)

- [ ] **Step 1: Add checkpointer initialization to lifespan**

In `services/director/src/main.py`, add the following changes:

1. Add imports at top:
```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from .agents.analyst import AnalystAgent
from orion_common.db.session import async_session_factory  # we'll verify this exists
```

2. Add module-level singleton:
```python
_checkpointer: AsyncPostgresSaver | None = None
```

3. In the `lifespan` function, after LLM provider init but before graph build, add:
```python
    # Initialise LangGraph checkpointer (PostgreSQL)
    checkpointer_connstr = settings.database_url_sync  # returns postgresql:// format
    _checkpointer = AsyncPostgresSaver.from_conn_string(checkpointer_connstr)
    await _checkpointer.setup()
```

4. Update the graph build call:
```python
    # Initialise Analyst agent
    analyst_agent = AnalystAgent(llm_provider)

    # Initialise content pipeline
    _graph = build_content_graph(
        script_generator=script_gen,
        critique_agent=CritiqueAgent(llm_provider, script_gen),
        visual_prompter=visual_prompter,
        analyst_agent=analyst_agent,
        session_factory=async_session_factory,
        checkpointer=_checkpointer,
        enable_hitl=True,
    )
```

5. In the shutdown section, add:
```python
    if _checkpointer is not None:
        await _checkpointer.conn.aclose()
    _checkpointer = None
```

6. Add `_checkpointer` to the `global` statement.

**Note:** `build_content_graph` doesn't accept `analyst_agent` or `session_factory` yet — those are added in Chunk 2 (Task 6). For now, this task only wires the checkpointer. The `analyst_agent` and `session_factory` params will be added when the builder is updated.

**Simplified version for Task 2 — only add checkpointer, keep enable_hitl and analyst for later:**

```python
    # Initialise LangGraph checkpointer (PostgreSQL)
    # Note: settings.database_url_sync exists in orion_common/config.py:55-60
    # and returns postgresql:// format (no +asyncpg suffix), which psycopg needs.
    checkpointer_connstr = settings.database_url_sync
    _checkpointer = AsyncPostgresSaver.from_conn_string(checkpointer_connstr)
    await _checkpointer.setup()

    _graph = build_content_graph(
        script_generator=script_gen,
        critique_agent=CritiqueAgent(llm_provider, script_gen),
        visual_prompter=visual_prompter,
        checkpointer=_checkpointer,
        enable_hitl=False,  # stays False until Chunk 2 wires analyst
    )
```

- [ ] **Step 2: Verify the session factory exists in orion-common**

Run: `cd services/director && grep -r "async_session_factory\|get_session" ../../libs/orion-common/orion_common/db/`

If `async_session_factory` doesn't exist, we'll create a simple callable later. For now, confirm what's available.

- [ ] **Step 3: Commit**

```bash
git add services/director/src/main.py
git commit -m "feat(ORION-76): initialize AsyncPostgresSaver checkpointer in director lifespan"
```

---

### Task 3: Add thread_id to Pipeline and Schemas

**Files:**
- Modify: `services/director/src/services/pipeline.py`
- Modify: `services/director/src/schemas.py`

- [ ] **Step 1: Add thread_id generation and return to pipeline.run()**

In `services/director/src/services/pipeline.py`, update `run()`:

1. Always generate a thread_id:
```python
        # 4. Invoke the graph
        if not thread_id:
            thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}
```

Replace the existing config block (lines 82-84) with the above.

2. Return thread_id in the result dict (line 163+):
```python
        return {
            "content_id": content_id,
            "thread_id": thread_id,
            "script": script,
            ...
        }
```

- [ ] **Step 2: Add thread_id to GenerateContentResponse schema**

In `services/director/src/schemas.py`, add to `GenerateContentResponse`:
```python
    thread_id: str | None = None
```

- [ ] **Step 3: Add cleanup_checkpoints method to ContentPipeline**

In `services/director/src/services/pipeline.py`, add a new method and store the checkpointer reference:

1. Update `__init__` to accept optional checkpointer:
```python
    def __init__(
        self,
        graph: CompiledStateGraph,
        event_bus: EventBus,
        vector_memory: VectorMemory | None = None,
        checkpointer: Any | None = None,
    ) -> None:
        self._graph = graph
        self._event_bus = event_bus
        self._vector_memory = vector_memory
        self._checkpointer = checkpointer
```

2. Add cleanup method:
```python
    async def cleanup_checkpoints(self, thread_id: str) -> None:
        """Delete checkpoint data for a completed thread."""
        if self._checkpointer is None:
            return
        try:
            async with self._checkpointer.conn.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "DELETE FROM checkpoint_writes WHERE thread_id = %s", (thread_id,)
                    )
                    await cur.execute(
                        "DELETE FROM checkpoints WHERE thread_id = %s", (thread_id,)
                    )
                await conn.commit()
            await logger.ainfo("checkpoints_cleaned", thread_id=thread_id)
        except Exception:
            await logger.aexception("checkpoint_cleanup_failed", thread_id=thread_id)
```

3. Call cleanup after successful completion in `run()` (after event publishing):
```python
        # 9. Cleanup checkpoints for completed pipeline
        await self.cleanup_checkpoints(thread_id)
```

4. Call cleanup after failure too (in the exception handler, after commit):
```python
            await self.cleanup_checkpoints(thread_id)
```

5. Also add cleanup to `resume()` method — after the final state is persisted (after `await session.commit()`):
```python
        # Cleanup checkpoints after terminal state
        thread_id_val = config.get("configurable", {}).get("thread_id", thread_id)
        await self.cleanup_checkpoints(thread_id_val)
```

- [ ] **Step 4: Commit**

```bash
git add services/director/src/services/pipeline.py services/director/src/schemas.py
git commit -m "feat(ORION-76): add thread_id tracking and checkpoint cleanup to pipeline"
```

---

### Task 4: Update Pipeline Constructor in main.py

**Files:**
- Modify: `services/director/src/main.py`

- [ ] **Step 1: Pass checkpointer to ContentPipeline**

Update the pipeline construction in `main.py` lifespan:
```python
    _pipeline = ContentPipeline(_graph, _event_bus, vector_memory=_vector_memory, checkpointer=_checkpointer)
```

- [ ] **Step 2: Commit**

```bash
git add services/director/src/main.py
git commit -m "feat(ORION-76): pass checkpointer to ContentPipeline"
```

---

### Task 5: Update conftest with Iteration Fields

**Files:**
- Modify: `services/director/tests/test_graph/conftest.py`

- [ ] **Step 1: Update sample_state to include iteration fields**

No new test needed — this prepares fixtures for Chunk 2 tests:

```python
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
        "iteration_count": 0,
        "max_iterations": 3,
    }
```

- [ ] **Step 2: Run all existing tests to verify nothing breaks**

Run: `cd services/director && uv run pytest tests/test_graph/ -v`
Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add services/director/tests/test_graph/conftest.py
git commit -m "feat(ORION-76): update test fixtures with iteration tracking fields"
```

---

## Chunk 2: ORION-77 — Analyst Agent + Analyst Node + HITL Gate

### Task 6: Create AnalystAgent Class

**Files:**
- Create: `services/director/src/agents/analyst.py`
- Create: `services/director/tests/test_agents/__init__.py`
- Create: `services/director/tests/test_agents/test_analyst.py`

- [ ] **Step 1: Write the failing test**

Create `services/director/tests/test_agents/__init__.py` (empty).

Create `services/director/tests/test_agents/test_analyst.py`:

```python
"""Tests for AnalystAgent."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.agents.analyst import AnalystAgent, AnalysisResult, ImprovementSuggestion
from src.providers.base import LLMProvider, LLMResponse


ANALYSIS_JSON = json.dumps({
    "performance_summary": "Pipeline completed in 45s. Critique score 0.85 is above average.",
    "benchmark_comparison": {
        "avg_duration_seconds": 50,
        "avg_critique_score": 0.75,
        "percentile_rank": 80,
    },
    "suggestions": [
        {
            "area": "hook",
            "suggestion": "Use a question format for higher engagement",
            "expected_impact": "high",
            "rationale": "Questions in hooks increase retention by 20%",
        }
    ],
    "overall_score": 0.82,
})


class FakeAnalystLLM(LLMProvider):
    def __init__(self, response: str = ANALYSIS_JSON) -> None:
        self._response = response

    async def generate(self, prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
        return LLMResponse(content=self._response, model="fake")

    async def is_available(self) -> bool:
        return True


class TestAnalystAgent:
    @pytest.mark.asyncio
    async def test_analyze_returns_analysis_result(self) -> None:
        llm = FakeAnalystLLM()
        agent = AnalystAgent(llm)

        # Mock session with query results
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        result = await agent.analyze(
            session=mock_session,
            content_id=uuid.uuid4(),
            niche="technology",
            script_hook="AI just changed everything",
            script_body="A breakthrough in AI...",
            critique_score=0.85,
        )

        assert isinstance(result, AnalysisResult)
        assert result.overall_score == 0.82
        assert len(result.suggestions) == 1
        assert result.suggestions[0].area == "hook"
        assert result.suggestions[0].expected_impact == "high"

    @pytest.mark.asyncio
    async def test_analyze_handles_llm_failure(self) -> None:
        bad_llm = AsyncMock(spec=LLMProvider)
        bad_llm.generate.side_effect = RuntimeError("LLM down")

        agent = AnalystAgent(bad_llm)
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        with pytest.raises(RuntimeError, match="LLM down"):
            await agent.analyze(
                session=mock_session,
                content_id=uuid.uuid4(),
                niche="technology",
                script_hook="hook",
                script_body="body",
                critique_score=0.5,
            )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && uv run pytest tests/test_agents/test_analyst.py -v`
Expected: FAIL — `src.agents.analyst` module does not exist

- [ ] **Step 3: Implement AnalystAgent**

Create `services/director/src/agents/analyst.py`:

```python
"""Performance analysis and improvement suggestion agent."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from orion_common.db.models import Content, ContentStatus, PipelineRun, PipelineStatus

from ..providers.base import LLMProvider

logger = structlog.get_logger(__name__)


class ImprovementSuggestion(BaseModel):
    """A single improvement suggestion from the analyst."""

    area: str = Field(description="Area of improvement: hook, body, cta, visuals")
    suggestion: str = Field(description="Specific actionable suggestion")
    expected_impact: str = Field(description="Expected impact: high, medium, low")
    rationale: str = Field(description="Why this improvement matters")


class AnalysisResult(BaseModel):
    """Full analysis result from the AnalystAgent."""

    performance_summary: str = Field(description="Summary of pipeline performance")
    benchmark_comparison: dict[str, Any] = Field(description="Comparison against recent content")
    suggestions: list[ImprovementSuggestion] = Field(description="Prioritized improvement suggestions")
    overall_score: float = Field(ge=0.0, le=1.0, description="Overall pipeline quality score")


_ANALYST_SYSTEM_PROMPT = """\
You are a performance analyst for an AI content creation pipeline. \
Given performance data and a content script, analyze the quality and suggest improvements.

Evaluate:
1. Pipeline performance (duration, success rate)
2. Content quality relative to benchmarks
3. Specific areas for improvement

IMPORTANT: Respond ONLY with valid JSON matching this schema:
{{
  "performance_summary": "...",
  "benchmark_comparison": {{
    "avg_duration_seconds": 0,
    "avg_critique_score": 0.0,
    "percentile_rank": 0
  }},
  "suggestions": [
    {{
      "area": "hook|body|cta|visuals",
      "suggestion": "...",
      "expected_impact": "high|medium|low",
      "rationale": "..."
    }}
  ],
  "overall_score": 0.0
}}
"""

_ANALYST_USER_PROMPT = """\
Analyze this content pipeline run:

SCRIPT HOOK: {hook}

SCRIPT BODY: {body}

CRITIQUE SCORE: {critique_score}

PIPELINE DURATION: {pipeline_duration}

BENCHMARK DATA (last 30 days, same niche):
- Completed content count: {benchmark_count}
- Average critique score: {avg_critique_score}
- Average pipeline duration: {avg_duration}

Provide a performance summary, benchmark comparison, and prioritized improvement suggestions.
"""


class AnalystAgent:
    """Analyzes pipeline performance and generates improvement suggestions.

    Queries shared PostgreSQL tables for performance data, then uses an LLM
    to generate structured analysis and recommendations.
    """

    def __init__(self, llm_provider: LLMProvider) -> None:
        self._llm = llm_provider

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def analyze(
        self,
        session: AsyncSession,
        content_id: UUID,
        niche: str,
        script_hook: str,
        script_body: str,
        critique_score: float,
    ) -> AnalysisResult:
        """Analyze pipeline performance and generate improvement suggestions.

        Args:
            session: Database session for querying performance data.
            content_id: ID of the content being analyzed.
            niche: Content niche for benchmark comparison.
            script_hook: The generated hook text.
            script_body: The generated body text.
            critique_score: CritiqueAgent's confidence score.

        Returns:
            AnalysisResult with performance summary, benchmarks, and suggestions.
        """
        # 1. Get pipeline run data for this content
        pipeline_duration = await self._get_pipeline_duration(session, content_id)

        # 2. Get benchmark data (last 30 days)
        benchmark = await self._get_benchmarks(session, niche)

        # 3. LLM analysis
        user_prompt = _ANALYST_USER_PROMPT.format(
            hook=script_hook,
            body=script_body,
            critique_score=critique_score,
            pipeline_duration=f"{pipeline_duration:.1f}s" if pipeline_duration else "N/A",
            benchmark_count=benchmark["count"],
            avg_critique_score=f"{benchmark['avg_critique_score']:.2f}",
            avg_duration=f"{benchmark['avg_duration']:.1f}s" if benchmark["avg_duration"] else "N/A",
        )

        response = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=_ANALYST_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=1024,
        )

        result = self._parse_analysis(response.content)

        await logger.ainfo(
            "analyst_completed",
            content_id=str(content_id),
            overall_score=result.overall_score,
            suggestion_count=len(result.suggestions),
        )

        return result

    async def _get_pipeline_duration(
        self, session: AsyncSession, content_id: UUID
    ) -> float | None:
        """Get total pipeline duration in seconds for this content."""
        stmt = select(PipelineRun).where(
            PipelineRun.content_id == content_id,
            PipelineRun.status == PipelineStatus.completed,
        )
        result = await session.execute(stmt)
        runs = result.scalars().all()

        if not runs:
            return None

        # Use the most recent completed run
        run = runs[-1]
        if run.completed_at and run.started_at:
            return (run.completed_at - run.started_at).total_seconds()
        return None

    async def _get_benchmarks(
        self, session: AsyncSession, niche: str
    ) -> dict[str, Any]:
        """Get benchmark data for the same niche over the last 30 days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        # Query recent completed content
        # Note: Content table has no `niche` column. We query all recent
        # completed content as a baseline. Niche filtering can be added
        # when the Content model is extended with a niche field.
        stmt = select(Content).where(
            Content.status == ContentStatus.review,
            Content.created_at >= cutoff,
        )
        result = await session.execute(stmt)
        recent_content = result.scalars().all()

        count = len(recent_content)

        # Get pipeline runs for benchmark duration
        content_ids = [c.id for c in recent_content]
        avg_duration: float | None = None
        if content_ids:
            run_stmt = select(PipelineRun).where(
                PipelineRun.content_id.in_(content_ids),
                PipelineRun.status == PipelineStatus.completed,
            )
            run_result = await session.execute(run_stmt)
            runs = run_result.scalars().all()

            durations = []
            for run in runs:
                if run.completed_at and run.started_at:
                    durations.append((run.completed_at - run.started_at).total_seconds())
            if durations:
                avg_duration = sum(durations) / len(durations)

        return {
            "count": count,
            "avg_critique_score": 0.0,  # Not stored on Content model — deferred
            "avg_duration": avg_duration,
        }

    @staticmethod
    def _parse_analysis(raw: str) -> AnalysisResult:
        """Parse the LLM analysis response into AnalysisResult."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:cleaned.rfind("```")]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return AnalysisResult.model_validate(data)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/director && uv run pytest tests/test_agents/test_analyst.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/director/src/agents/analyst.py services/director/tests/test_agents/
git commit -m "feat(ORION-77): implement AnalystAgent with performance analysis and benchmarks"
```

---

### Task 7: Add Analyst Node and HITL Gate

**Files:**
- Modify: `services/director/src/graph/nodes.py`
- Modify: `services/director/src/graph/hitl.py`
- Create: `services/director/tests/test_graph/test_analyst.py`

- [ ] **Step 1: Write the failing tests**

Create `services/director/tests/test_graph/test_analyst.py`:

```python
"""Tests for analyst node and HITL gate."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.graph.nodes import analyst_node, analyst_hitl_gate
from src.graph.hitl import build_analyst_review_payload
from src.graph.state import OrionState, PipelineStage
from src.agents.analyst import AnalystAgent
from src.providers.base import LLMResponse


ANALYSIS_JSON = json.dumps({
    "performance_summary": "Pipeline completed successfully.",
    "benchmark_comparison": {"avg_duration_seconds": 50, "avg_critique_score": 0.75, "percentile_rank": 80},
    "suggestions": [
        {"area": "hook", "suggestion": "Use questions", "expected_impact": "high", "rationale": "Engagement"}
    ],
    "overall_score": 0.82,
})


@asynccontextmanager
async def fake_session_factory():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result
    yield mock_session


class TestAnalystNode:
    @pytest.mark.asyncio
    async def test_analyst_produces_analysis(self, fake_llm) -> None:
        fake_llm._response_content = ANALYSIS_JSON
        agent = AnalystAgent(fake_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "AI breakthroughs",
            "niche": "technology",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.ANALYST,
            "script_hook": "AI just changed everything",
            "script_body": "A breakthrough in AI...",
            "script_cta": "Follow for more",
            "visual_cues": [],
            "critique_score": 0.85,
            "critique_feedback": "Strong hook",
            "visual_prompts": {},
        }

        result = await analyst_node(
            state,
            analyst_agent=agent,
            session_factory=fake_session_factory,
        )

        assert result["current_stage"] == PipelineStage.COMPLETE
        assert result["analyst_score"] == 0.82
        assert "performance_summary" in result
        assert len(result["improvement_suggestions"]) == 1

    @pytest.mark.asyncio
    async def test_analyst_sets_failed_on_error(self) -> None:
        bad_llm = AsyncMock()
        bad_llm.generate.side_effect = RuntimeError("LLM down")
        agent = AnalystAgent(bad_llm)

        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.ANALYST,
            "script_hook": "hook",
            "script_body": "body",
            "script_cta": "cta",
            "visual_cues": [],
            "critique_score": 0.5,
            "critique_feedback": "ok",
            "visual_prompts": {},
        }

        result = await analyst_node(
            state,
            analyst_agent=agent,
            session_factory=fake_session_factory,
        )

        assert result["current_stage"] == PipelineStage.FAILED
        assert "LLM down" in result["error"]


class TestAnalystHitlGate:
    @pytest.mark.asyncio
    async def test_skips_on_failure(self) -> None:
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
        result = await analyst_hitl_gate(state)
        assert result == {}


class TestBuildAnalystReviewPayload:
    def test_builds_payload(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(),
            "trend_id": uuid.uuid4(),
            "trend_topic": "test",
            "niche": "tech",
            "target_platform": "youtube_shorts",
            "tone": "informative",
            "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "performance_summary": "Good run",
            "improvement_suggestions": [{"area": "hook", "suggestion": "shorter"}],
            "analyst_score": 0.82,
        }

        payload = build_analyst_review_payload(state)

        assert payload["stage"] == "analyst"
        assert payload["performance_summary"] == "Good run"
        assert payload["analyst_score"] == 0.82
        assert len(payload["improvement_suggestions"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && uv run pytest tests/test_graph/test_analyst.py -v`
Expected: FAIL — `analyst_node`, `analyst_hitl_gate`, `build_analyst_review_payload` don't exist

- [ ] **Step 3: Add build_analyst_review_payload to hitl.py**

In `services/director/src/graph/hitl.py`, add:

```python
def build_analyst_review_payload(state: OrionState) -> dict[str, Any]:
    """Build the interrupt payload for human review after analyst."""
    return {
        "stage": "analyst",
        "instruction": "Review the performance analysis and improvement suggestions. Approve to cycle back for improvements, or reject to finalise as-is.",
        "performance_summary": state.get("performance_summary", ""),
        "improvement_suggestions": state.get("improvement_suggestions", []),
        "analyst_score": state.get("analyst_score", 0.0),
        "iteration_count": state.get("iteration_count", 0),
        "max_iterations": state.get("max_iterations", 3),
    }
```

- [ ] **Step 4: Add analyst_node and analyst_hitl_gate to nodes.py**

In `services/director/src/graph/nodes.py`, first update imports at the top of the file:

```python
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from ..agents.analyst import AnalystAgent
```

Update the hitl import line to include the new payload builder:
```python
from .hitl import build_analyst_review_payload, build_creator_review_payload, build_strategist_review_payload
```

Then add the node functions:

```python
async def analyst_node(
    state: OrionState,
    *,
    analyst_agent: AnalystAgent,
    session_factory: Callable,
) -> dict[str, Any]:
    """Analyze pipeline performance and generate improvement suggestions."""
    await logger.ainfo("analyst_node_started", content_id=str(state.get("content_id", "")))

    try:
        async with session_factory() as session:
            result = await analyst_agent.analyze(
                session=session,
                content_id=state["content_id"],
                niche=state.get("niche", "technology"),
                script_hook=state.get("script_hook", ""),
                script_body=state.get("script_body", ""),
                critique_score=state.get("critique_score", 0.0),
            )

        await logger.ainfo(
            "analyst_node_completed",
            overall_score=result.overall_score,
            suggestion_count=len(result.suggestions),
        )

        return {
            "performance_summary": result.performance_summary,
            "improvement_suggestions": [s.model_dump() for s in result.suggestions],
            "analyst_score": result.overall_score,
            "current_stage": PipelineStage.COMPLETE,
        }

    except Exception as exc:
        await logger.aexception("analyst_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }


async def analyst_hitl_gate(state: OrionState) -> dict[str, Any]:
    """HITL gate after analyst: pause for human review of analysis."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return {}

    payload = build_analyst_review_payload(state)
    decision = interrupt(payload)

    approved = decision.get("approved", False) if isinstance(decision, dict) else bool(decision)
    feedback = decision.get("feedback") if isinstance(decision, dict) else None

    if not approved:
        await logger.ainfo("analyst_hitl_rejected", feedback=feedback)
        return {
            "current_stage": PipelineStage.COMPLETE,  # No improvements, just finalise
            "hitl_decisions": [{"stage": "analyst", "approved": False, "feedback": feedback}],
        }

    await logger.ainfo("analyst_hitl_approved")
    return {
        "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/director && uv run pytest tests/test_graph/test_analyst.py -v`
Expected: PASS

- [ ] **Step 6: Run all graph tests to verify nothing breaks**

Run: `cd services/director && uv run pytest tests/test_graph/ -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add services/director/src/graph/nodes.py services/director/src/graph/hitl.py services/director/tests/test_graph/test_analyst.py
git commit -m "feat(ORION-77): add analyst node, HITL gate, and review payload builder"
```

---

## Chunk 3: ORION-78 — Feedback Loop + Builder Wiring

### Task 8: Update Edge Functions for Analyst Routing

**Files:**
- Modify: `services/director/src/graph/edges.py`
- Modify: `services/director/tests/test_graph/test_edges.py`

- [ ] **Step 1: Write the failing tests**

In `services/director/tests/test_graph/test_edges.py`, update imports and add tests:

```python
from src.graph.edges import (
    route_after_strategist,
    route_after_creator,
    route_after_analyst,
    route_after_analyst_hitl,
)
```

Add new test classes:

```python
class TestRouteAfterCreatorUpdated:
    """After Sprint 7, route_after_creator routes to analyst, not END."""

    def test_routes_to_analyst_on_success(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE, "visual_prompts": {"prompts": []},
        }
        assert route_after_creator(state) == "analyst"

    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED, "error": "failed",
        }
        assert route_after_creator(state) == END


class TestRouteAfterAnalyst:
    def test_routes_to_end(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
        }
        assert route_after_analyst(state) == END


class TestRouteAfterAnalystHitl:
    def test_routes_to_end_on_failure(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.FAILED,
        }
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_end_on_no_decisions(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
        }
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_end_on_rejection(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": False, "feedback": "no"}],
        }
        assert route_after_analyst_hitl(state) == END

    def test_routes_to_strategist_on_approval_under_limit(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
            "iteration_count": 1,
            "max_iterations": 3,
        }
        assert route_after_analyst_hitl(state) == "strategist"

    def test_routes_to_end_on_approval_at_limit(self) -> None:
        state: OrionState = {
            "content_id": uuid.uuid4(), "trend_id": uuid.uuid4(),
            "trend_topic": "test", "niche": "tech", "target_platform": "youtube_shorts",
            "tone": "informative", "visual_style": "cinematic",
            "current_stage": PipelineStage.COMPLETE,
            "hitl_decisions": [{"stage": "analyst", "approved": True, "feedback": None}],
            "iteration_count": 3,
            "max_iterations": 3,
        }
        assert route_after_analyst_hitl(state) == END
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && uv run pytest tests/test_graph/test_edges.py -v`
Expected: FAIL — `route_after_analyst`, `route_after_analyst_hitl` don't exist; existing `route_after_creator` tests fail (old behavior)

- [ ] **Step 3: Update edge functions**

Replace `services/director/src/graph/edges.py`:

```python
"""Conditional edge routing for the content creation graph."""

from __future__ import annotations

from langgraph.graph import END

from .state import OrionState, PipelineStage


def route_after_strategist(state: OrionState) -> str:
    """Decide next node after the strategist. Routes to 'creator' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator"


def route_after_creator(state: OrionState) -> str:
    """Decide next node after the creator. Routes to 'analyst' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "analyst"


def route_after_creator_hitl(state: OrionState) -> str:
    """Decide next node after creator when HITL is enabled.
    Routes to 'creator_review' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "creator_review"


def route_after_analyst(state: OrionState) -> str:
    """Decide next node after analyst (non-HITL path). Always routes to END."""
    return END


def route_after_analyst_hitl(state: OrionState) -> str:
    """Route after analyst HITL gate. Cycles back to strategist if approved
    and iteration limit not reached, otherwise END."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    decisions = state.get("hitl_decisions", [])
    if not decisions:
        return END
    last = decisions[-1]
    if not last.get("approved", False):
        return END
    count = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", 3)
    if count < max_iter:
        return "strategist"
    return END
```

- [ ] **Step 4: Update the old TestRouteAfterCreator test**

The old test `TestRouteAfterCreator.test_routes_to_end_on_success` now expects `"analyst"` instead of `END`. Update it in the test file or remove it since the new `TestRouteAfterCreatorUpdated` covers it.

Remove the old `TestRouteAfterCreator` class and keep only the new one.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/director && uv run pytest tests/test_graph/test_edges.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add services/director/src/graph/edges.py services/director/tests/test_graph/test_edges.py
git commit -m "feat(ORION-78): update edge routing for analyst node and feedback loop"
```

---

### Task 9: Update Graph Builder with Analyst + Feedback Loop

**Files:**
- Modify: `services/director/src/graph/builder.py`
- Modify: `services/director/tests/test_graph/test_builder.py`

- [ ] **Step 1: Write the failing test**

In `services/director/tests/test_graph/test_builder.py`, add a test for the analyst node in the graph:

```python
# Add to test file (read existing tests first to understand structure)

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/director && uv run pytest tests/test_graph/test_builder.py::TestBuildContentGraphWithAnalyst -v`
Expected: FAIL — `build_content_graph` does not accept `analyst_agent` or `session_factory`

- [ ] **Step 3: Update graph builder**

Replace `services/director/src/graph/builder.py`:

```python
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
            # Legacy 2-node path (no analyst)
            workflow.add_edge("creator", END)

    return workflow.compile(checkpointer=checkpointer)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/director && uv run pytest tests/test_graph/test_builder.py -v`
Expected: All PASS

- [ ] **Step 5: Run all graph tests**

Run: `cd services/director && uv run pytest tests/test_graph/ -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add services/director/src/graph/builder.py services/director/tests/test_graph/test_builder.py
git commit -m "feat(ORION-78): wire analyst node and feedback loop into graph builder"
```

---

### Task 10: Update Strategist Node for Feedback Loop Context

**Files:**
- Modify: `services/director/src/graph/nodes.py`

- [ ] **Step 1: Update strategist_node to handle iteration context**

In `services/director/src/graph/nodes.py`, update `strategist_node` to:
1. Increment `iteration_count` when `improvement_suggestions` exist in state
2. Pass suggestions as additional context to the ScriptRequest

```python
async def strategist_node(
    state: OrionState,
    *,
    script_generator: ScriptGenerator,
    critique_agent: CritiqueAgent,
) -> dict[str, Any]:
    """Generate an H-V-C script and critique it."""
    await logger.ainfo("strategist_node_started", trend_topic=state["trend_topic"])

    try:
        # Determine if this is a feedback loop iteration
        suggestions = state.get("improvement_suggestions", [])
        iteration = state.get("iteration_count", 0)

        request = ScriptRequest(
            trend_topic=state["trend_topic"],
            niche=state.get("niche", "technology"),
            target_platform=state.get("target_platform", "youtube_shorts"),
            tone=state.get("tone", "informative and engaging"),
        )

        script: GeneratedScript = await script_generator.generate_script(request)

        script, critique_result = await critique_agent.critique_and_refine(
            script=script, request=request,
        )

        await logger.ainfo(
            "strategist_node_completed",
            hook_length=len(script.hook.split()),
            critique_score=critique_result.confidence_score,
            iteration=iteration,
        )

        result: dict[str, Any] = {
            "script_hook": script.hook,
            "script_body": script.body,
            "script_cta": script.cta,
            "visual_cues": script.visual_cues,
            "critique_score": critique_result.confidence_score,
            "critique_feedback": critique_result.feedback,
            "current_stage": PipelineStage.CREATOR,
        }

        # Increment iteration count on re-entry (feedback loop)
        if suggestions:
            result["iteration_count"] = iteration + 1

        return result

    except Exception as exc:
        await logger.aexception("strategist_node_failed")
        return {
            "current_stage": PipelineStage.FAILED,
            "error": str(exc),
        }
```

- [ ] **Step 2: Run all tests**

Run: `cd services/director && uv run pytest tests/test_graph/ -v`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add services/director/src/graph/nodes.py
git commit -m "feat(ORION-78): strategist node increments iteration count on feedback loop re-entry"
```

---

### Task 11: Update Pipeline for Iteration Tracking and Event Gating

**Files:**
- Modify: `services/director/src/services/pipeline.py`

- [ ] **Step 1: Add iteration tracking and event gating**

In `services/director/src/services/pipeline.py`, update `run()`:

1. Set initial iteration fields in state (line 70+):
```python
        initial_state: OrionState = {
            ...
            "iteration_count": 0,
            "max_iterations": 3,
        }
```

2. Gate event publishing — only publish when the pipeline is NOT cycling back:
```python
        # 8. Publish CONTENT_CREATED event (only on final completion, not mid-feedback-loop)
        # Check if the analyst HITL approved a cycle-back that's still within limits
        decisions = final_state.get("hitl_decisions", [])
        last_decision = decisions[-1] if decisions else {}
        final_iteration = final_state.get("iteration_count", 0)
        max_iter = final_state.get("max_iterations", 3)
        cycling_back = last_decision.get("approved", False) and final_iteration < max_iter
        is_final = not cycling_back

        if is_final:
            await self._event_bus.publish(
                Channels.CONTENT_CREATED,
                {
                    "content_id": str(content_id),
                    "trend_id": str(trend_id),
                    "title": content.title,
                    "status": ContentStatus.review.value,
                },
            )
```

3. Return iteration_count in result:
```python
        return {
            "content_id": content_id,
            "thread_id": thread_id,
            "iteration_count": final_state.get("iteration_count", 0),
            "script": script,
            ...
        }
```

- [ ] **Step 2: Commit**

```bash
git add services/director/src/services/pipeline.py
git commit -m "feat(ORION-78): gate event publishing and track iterations in pipeline"
```

---

### Task 12: Wire Analyst + Checkpointer in main.py

**Files:**
- Modify: `services/director/src/main.py`

- [ ] **Step 1: Create async session context manager for analyst node**

`orion_common.db.session` does NOT export a public `async_session_factory`. Create a local async context manager in `main.py` that the analyst node can use:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker

# In lifespan, after engine init:
_async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

@asynccontextmanager
async def _session_ctx():
    async with _async_session_maker() as session:
        yield session
```

This `_session_ctx` is then passed as `session_factory` to `build_content_graph`.

- [ ] **Step 2: Update lifespan to wire analyst and enable HITL**

```python
    # Initialise Analyst agent
    analyst_agent = AnalystAgent(llm_provider)

    _graph = build_content_graph(
        script_generator=script_gen,
        critique_agent=CritiqueAgent(llm_provider, script_gen),
        visual_prompter=visual_prompter,
        analyst_agent=analyst_agent,
        session_factory=_session_ctx,
        checkpointer=_checkpointer,
        enable_hitl=True,
    )
```

- [ ] **Step 3: Commit**

```bash
git add services/director/src/main.py
git commit -m "feat(ORION-77,ORION-78): wire analyst agent and enable HITL in director lifespan"
```

---

## Chunk 4: ORION-79 — Gateway Rate Limiting

### Task 13: Add go-redis Dependency

**Files:**
- Modify: `go.mod`, `go.sum`

- [ ] **Step 1: Add go-redis and miniredis**

```bash
cd /home/gishantsingh/Dev/Projects/orion && go get github.com/redis/go-redis/v9
cd /home/gishantsingh/Dev/Projects/orion && go get github.com/alicebob/miniredis/v2
```

- [ ] **Step 2: Verify**

Run: `grep "go-redis" go.mod`
Expected: `github.com/redis/go-redis/v9 v9.x.x`

- [ ] **Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "chore(ORION-79): add go-redis/v9 and miniredis dependencies"
```

---

### Task 14: Implement Rate Limit Middleware

**Files:**
- Create: `internal/gateway/middleware/ratelimit.go`
- Create: `internal/gateway/middleware/ratelimit_test.go`

- [ ] **Step 1: Write the failing test**

Create `internal/gateway/middleware/ratelimit_test.go`:

```go
package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

func setupMiniredis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return mr, rdb
}

func TestRateLimit(t *testing.T) {
	_, rdb := setupMiniredis(t)
	defer rdb.Close()

	cfg := middleware.RateLimitConfig{
		Group:  "test",
		Limit:  3,
		Window: time.Minute,
	}

	handler := middleware.RateLimit(rdb, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	tests := []struct {
		name       string
		requests   int
		wantStatus int
	}{
		{"first request allowed", 1, http.StatusOK},
		{"second request allowed", 2, http.StatusOK},
		{"third request allowed", 3, http.StatusOK},
		{"fourth request blocked", 4, http.StatusTooManyRequests},
	}

	for i, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if i+1 != tc.requests {
				t.Skip("sequential test")
			}
		})
	}

	// Run sequentially
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if i < 3 {
			if w.Code != http.StatusOK {
				t.Errorf("request %d: want %d, got %d", i+1, http.StatusOK, w.Code)
			}
		} else {
			if w.Code != http.StatusTooManyRequests {
				t.Errorf("request %d: want %d, got %d", i+1, http.StatusTooManyRequests, w.Code)
			}
			// Check response body
			var errResp map[string]interface{}
			if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
				t.Fatal(err)
			}
			errObj, ok := errResp["error"].(map[string]interface{})
			if !ok {
				t.Fatal("expected error object")
			}
			if errObj["code"] != "RATE_LIMIT_EXCEEDED" {
				t.Errorf("want RATE_LIMIT_EXCEEDED, got %s", errObj["code"])
			}
			// Check headers
			if w.Header().Get("Retry-After") == "" {
				t.Error("expected Retry-After header")
			}
			if w.Header().Get("X-RateLimit-Limit") != "3" {
				t.Errorf("want X-RateLimit-Limit=3, got %s", w.Header().Get("X-RateLimit-Limit"))
			}
		}
	}
}

func TestRateLimitDifferentGroups(t *testing.T) {
	_, rdb := setupMiniredis(t)
	defer rdb.Close()

	cfgA := middleware.RateLimitConfig{Group: "groupA", Limit: 1, Window: time.Minute}
	cfgB := middleware.RateLimitConfig{Group: "groupB", Limit: 1, Window: time.Minute}

	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	handlerA := middleware.RateLimit(rdb, cfgA)(ok)
	handlerB := middleware.RateLimit(rdb, cfgB)(ok)

	// First request to group A — allowed
	req := httptest.NewRequest("GET", "/a", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w := httptest.NewRecorder()
	handlerA.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("group A first request: want 200, got %d", w.Code)
	}

	// First request to group B — also allowed (different group)
	req = httptest.NewRequest("GET", "/b", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w = httptest.NewRecorder()
	handlerB.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("group B first request: want 200, got %d", w.Code)
	}

	// Second request to group A — blocked
	req = httptest.NewRequest("GET", "/a", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w = httptest.NewRecorder()
	handlerA.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("group A second request: want 429, got %d", w.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go test ./internal/gateway/middleware/ -run TestRateLimit -v`
Expected: FAIL — compilation error, RateLimit not defined

- [ ] **Step 3: Implement rate limit middleware**

Create `internal/gateway/middleware/ratelimit.go`:

```go
package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimitConfig configures rate limiting for a route group.
type RateLimitConfig struct {
	Group  string
	Limit  int
	Window time.Duration
}

// RateLimit returns Chi-compatible middleware that enforces a sliding window
// rate limit using Redis. Requests exceeding the limit receive 429.
func RateLimit(rdb *redis.Client, cfg RateLimitConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			identifier := extractIdentifier(r)

			windowStart := time.Now().Truncate(cfg.Window)
			key := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Unix())
			prevKey := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Add(-cfg.Window).Unix())

			allowed, remaining, err := checkRateLimit(ctx, rdb, key, prevKey, cfg)
			if err != nil {
				// On Redis failure, allow the request (fail open)
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
			resetTime := windowStart.Add(cfg.Window)
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

			if !allowed {
				retryAfter := int(time.Until(resetTime).Seconds()) + 1
				if retryAfter < 1 {
					retryAfter = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)

				errResp := map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": fmt.Sprintf("Rate limit exceeded for %s. Try again in %ds.", cfg.Group, retryAfter),
						"status":  http.StatusTooManyRequests,
					},
				}
				json.NewEncoder(w).Encode(errResp)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func checkRateLimit(
	ctx context.Context,
	rdb *redis.Client,
	key, prevKey string,
	cfg RateLimitConfig,
) (allowed bool, remaining int, err error) {
	// Increment current window
	count, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, fmt.Errorf("redis incr: %w", err)
	}

	// Set expiry on first increment
	if count == 1 {
		rdb.Expire(ctx, key, cfg.Window*2)
	}

	// Get previous window count for sliding calculation
	prevCount, _ := rdb.Get(ctx, prevKey).Int64()

	// Sliding window: weight previous window by remaining fraction
	elapsed := time.Since(time.Now().Truncate(cfg.Window))
	weight := 1.0 - (float64(elapsed) / float64(cfg.Window))
	if weight < 0 {
		weight = 0
	}
	total := int(float64(prevCount)*weight) + int(count)

	remaining = cfg.Limit - total
	if remaining < 0 {
		remaining = 0
	}

	return total <= cfg.Limit, remaining, nil
}

func extractIdentifier(r *http.Request) string {
	// Use X-Forwarded-For if behind a proxy
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go test ./internal/gateway/middleware/ -run TestRateLimit -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/gateway/middleware/ratelimit.go internal/gateway/middleware/ratelimit_test.go
git commit -m "feat(ORION-79): implement Redis sliding window rate limit middleware"
```

---

### Task 15: Update Gateway Router with Rate Limiting

**Files:**
- Modify: `internal/gateway/router/router.go`
- Modify: `pkg/config/config.go` (no change needed — RedisURL already exists)

- [ ] **Step 1: Update router to use per-service route groups**

Replace the flat proxy loop in `internal/gateway/router/router.go` with explicit route groups:

```go
package router

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/middleware"
	"github.com/orion-rigel/orion/pkg/config"
)

// New creates and returns a fully-configured Chi router with middleware
// and routes for the gateway service.
func New(cfg config.Config) (chi.Router, error) {
	r := chi.NewRouter()

	// Middleware stack: RequestID -> Logger -> Recoverer -> CORS
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CORS)

	// Health and readiness endpoints.
	r.Get("/health", handlers.Health())
	r.Get("/ready", handlers.Ready())

	// Service URLs for health aggregation and proxying.
	services := map[string]string{
		"scout":    cfg.ScoutURL,
		"director": cfg.DirectorURL,
		"media":    cfg.MediaURL,
		"editor":   cfg.EditorURL,
		"pulse":    cfg.PulseURL,
	}

	// Aggregated status endpoint — checks all downstream services concurrently.
	r.Get("/status", handlers.Status(services))

	// Redis client for rate limiting
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Warn("redis_url_parse_failed, rate limiting disabled", "error", err)
		// Fall back to flat proxy without rate limiting
		return mountFlatProxy(r, services)
	}
	rdb := redis.NewClient(opt)

	// Per-service route groups with rate limiting
	for name, url := range services {
		proxy, err := handlers.NewServiceProxy(url)
		if err != nil {
			return nil, fmt.Errorf("creating proxy for %s: %w", name, err)
		}

		rlCfg := rateLimitForService(name)

		r.Route(fmt.Sprintf("/api/v1/%s", name), func(sub chi.Router) {
			if rlCfg.writeLimit > 0 {
				// Method-aware rate limiting for services with distinct read/write limits
				sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
					Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
				})).Post("/*", proxy.ServeHTTP)
				sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
					Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
				})).Put("/*", proxy.ServeHTTP)
				sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
					Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
				})).Delete("/*", proxy.ServeHTTP)
				sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
					Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
				})).Get("/*", proxy.ServeHTTP)
			} else {
				// Single rate limit for all methods
				sub.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
					Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
				}))
				sub.Handle("/*", proxy)
			}
		})

		slog.Info("registered service proxy",
			"service", name,
			"target", url,
			"rate_limit_group", rlCfg.readGroup,
		)
	}

	return r, nil
}

type serviceRateLimit struct {
	readGroup  string
	readLimit  int
	writeGroup string
	writeLimit int // 0 means same limit for all methods
}

func rateLimitForService(name string) serviceRateLimit {
	switch name {
	case "director":
		return serviceRateLimit{
			readGroup: "content_read", readLimit: 100,
			writeGroup: "content_write", writeLimit: 20,
		}
	case "scout":
		return serviceRateLimit{readGroup: "triggers", readLimit: 10}
	case "pulse", "media", "editor":
		return serviceRateLimit{readGroup: "system", readLimit: 60}
	default:
		return serviceRateLimit{readGroup: "system", readLimit: 60}
	}
}

func mountFlatProxy(r chi.Router, services map[string]string) (chi.Router, error) {
	for name, url := range services {
		proxy, err := handlers.NewServiceProxy(url)
		if err != nil {
			return nil, fmt.Errorf("creating proxy for %s: %w", name, err)
		}
		pattern := fmt.Sprintf("/api/v1/%s/*", name)
		r.Handle(pattern, proxy)
		slog.Info("registered service proxy (no rate limit)",
			"service", name,
			"target", url,
			"pattern", pattern,
		)
	}
	return r, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go build ./...`
Expected: SUCCESS

- [ ] **Step 3: Run existing tests**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go test ./... -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/gateway/router/router.go
git commit -m "feat(ORION-79): restructure gateway router with per-service rate limiting"
```

---

## Chunk 5: ORION-80 — Prometheus Metrics

### Task 16: Add prometheus-fastapi-instrumentator to orion-common

**Files:**
- Modify: `libs/orion-common/pyproject.toml`
- Modify: `libs/orion-common/orion_common/health.py`

- [ ] **Step 1: Add dependency**

In `libs/orion-common/pyproject.toml`, add to dependencies:
```
    "prometheus-fastapi-instrumentator>=7.0.0",
```

- [ ] **Step 2: Remove placeholder /metrics and add instrument_app**

In `libs/orion-common/orion_common/health.py`:

1. Remove the `/metrics` route from `create_health_router()` (lines 94-98)
2. Add `instrument_app` function:

```python
def instrument_app(app: "FastAPI", service_name: str) -> None:
    """Attach Prometheus metrics instrumentation to a FastAPI app.

    Auto-instruments all HTTP endpoints and exposes /metrics endpoint
    in Prometheus text format.

    Args:
        app: The FastAPI application instance.
        service_name: Service identifier used as a metric label.
    """
    from prometheus_client import Info
    from prometheus_fastapi_instrumentator import Instrumentator

    # Set service identity label
    service_info = Info("orion_service", "Orion service information")
    service_info.info({"service_name": service_name})

    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        excluded_handlers=["/health", "/ready", "/metrics"],
        metric_namespace=service_name.replace("-", "_"),
    )
    instrumentator.instrument(app)
    instrumentator.expose(app, endpoint="/metrics", tags=["metrics"])
```

- [ ] **Step 3: Install updated deps**

Run: `cd libs/orion-common && uv pip install -e .`

- [ ] **Step 4: Verify placeholder /metrics removed and instrument_app works**

Run: `cd services/director && uv run python -c "from orion_common.health import instrument_app; print('import OK')"`
Expected: `import OK`

Run: `cd services/director && uv run python -c "from orion_common.health import create_health_router; r = create_health_router('test'); routes = [r.path for r in r.routes]; assert '/metrics' not in routes; print('placeholder removed OK')"`
Expected: `placeholder removed OK`

- [ ] **Step 5: Commit**

```bash
git add libs/orion-common/pyproject.toml libs/orion-common/orion_common/health.py
git commit -m "feat(ORION-80): add prometheus-fastapi-instrumentator and instrument_app to orion-common"
```

---

### Task 17: Add Director Custom Metrics

**Files:**
- Create: `services/director/src/metrics.py`
- Modify: `services/director/src/services/pipeline.py`

- [ ] **Step 1: Create metrics module**

Create `services/director/src/metrics.py`:

```python
"""Prometheus custom metrics for the Director service."""

from prometheus_client import Counter, Histogram

CONTENT_TOTAL = Counter(
    "orion_content_total",
    "Content items created, labeled by final status",
    ["status"],
)

GENERATION_DURATION = Histogram(
    "orion_content_generation_duration_seconds",
    "Time taken for the full content generation pipeline",
    ["stage"],
    buckets=[1, 5, 10, 30, 60, 120, 300],
)

CONFIDENCE_SCORE = Histogram(
    "orion_content_confidence_score",
    "Distribution of critique confidence scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)
```

- [ ] **Step 2: Instrument pipeline.py**

In `services/director/src/services/pipeline.py`, add imports:

```python
import time
from ..metrics import CONFIDENCE_SCORE, CONTENT_TOTAL, GENERATION_DURATION
```

Add instrumentation in `run()`:

1. At pipeline start:
```python
        CONTENT_TOTAL.labels(status="generating").inc()
        pipeline_start = time.monotonic()
```

2. After graph completes successfully (before event publishing):
```python
        pipeline_duration = time.monotonic() - pipeline_start
        GENERATION_DURATION.labels(stage="full_pipeline").observe(pipeline_duration)
        CONFIDENCE_SCORE.observe(critique_score)
        CONTENT_TOTAL.labels(status="review").inc()
```

3. In the failure handler:
```python
        CONTENT_TOTAL.labels(status="failed").inc()
```

- [ ] **Step 3: Verify metrics module imports correctly**

Run: `cd services/director && uv run python -c "from src.metrics import CONTENT_TOTAL, GENERATION_DURATION, CONFIDENCE_SCORE; CONTENT_TOTAL.labels(status='test').inc(); print('metrics OK')"`
Expected: `metrics OK`

- [ ] **Step 4: Commit**

```bash
git add services/director/src/metrics.py services/director/src/services/pipeline.py
git commit -m "feat(ORION-80): add Director custom Prometheus metrics"
```

---

### Task 18: Instrument Director main.py with Prometheus

**Files:**
- Modify: `services/director/src/main.py`

- [ ] **Step 1: Add instrument_app call**

In `services/director/src/main.py`, add after the router includes:

```python
from orion_common.health import create_health_router, instrument_app
```

After `app.include_router(content_router)`:

```python
instrument_app(app, service_name="director")
```

- [ ] **Step 2: Commit**

```bash
git add services/director/src/main.py
git commit -m "feat(ORION-80): instrument director service with Prometheus metrics"
```

---

### Task 19: Add Go Gateway Prometheus Metrics Middleware

**Files:**
- Create: `internal/gateway/middleware/metrics.go`
- Create: `internal/gateway/middleware/metrics_test.go`
- Modify: `go.mod`, `go.sum`

- [ ] **Step 1: Add prometheus/client_golang dependency**

```bash
cd /home/gishantsingh/Dev/Projects/orion && go get github.com/prometheus/client_golang/prometheus
cd /home/gishantsingh/Dev/Projects/orion && go get github.com/prometheus/client_golang/prometheus/promhttp
```

- [ ] **Step 2: Create metrics middleware**

Create `internal/gateway/middleware/metrics.go`:

```go
package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "orion_gateway_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status_code"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "orion_gateway_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	httpActiveConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "orion_gateway_active_connections",
			Help: "Number of active HTTP connections",
		},
	)
)

// Metrics records request count, duration, and active connections for Prometheus.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpActiveConnections.Inc()
		defer httpActiveConnections.Dec()

		start := time.Now()
		rw := newResponseWriter(w)

		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)

		httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, status).Inc()
		httpRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
	})
}
```

- [ ] **Step 3: Create metrics test**

Create `internal/gateway/middleware/metrics_test.go`:

```go
package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

func TestMetrics(t *testing.T) {
	handler := middleware.Metrics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}
```

- [ ] **Step 4: Mount metrics in router**

In `internal/gateway/router/router.go`, add to imports:

```go
	"github.com/prometheus/client_golang/prometheus/promhttp"
```

In the `New` function, add metrics middleware to global chain and mount `/metrics`:

```go
	r.Use(middleware.Metrics)

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())
```

Add `r.Use(middleware.Metrics)` after the existing middleware chain (after CORS).

- [ ] **Step 5: Run tests**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go test ./internal/gateway/middleware/ -v`
Expected: PASS

Run: `cd /home/gishantsingh/Dev/Projects/orion && go build ./...`
Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add internal/gateway/middleware/metrics.go internal/gateway/middleware/metrics_test.go internal/gateway/router/router.go go.mod go.sum
git commit -m "feat(ORION-80): add Prometheus metrics middleware and /metrics endpoint to gateway"
```

---

### Task 20: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all Python director tests**

Run: `cd services/director && uv run pytest tests/ -v`
Expected: All PASS

- [ ] **Step 2: Run all Go tests**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go test ./... -v`
Expected: All PASS

- [ ] **Step 3: Verify Go builds**

Run: `cd /home/gishantsingh/Dev/Projects/orion && go build ./...`
Expected: SUCCESS

---

## Summary

| Chunk | Tickets | Tasks | Key Deliverables |
|-------|---------|-------|-----------------|
| 1 | ORION-76 | 1-5 | OrionState fields, AsyncPostgresSaver, thread_id, checkpoint cleanup |
| 2 | ORION-77 | 6-7 | AnalystAgent, analyst_node, analyst_hitl_gate |
| 3 | ORION-78 | 8-12 | Feedback loop edges, builder wiring, iteration tracking, event gating |
| 4 | ORION-79 | 13-15 | Redis rate limiter middleware, router restructure |
| 5 | ORION-80 | 16-20 | Prometheus instrumentator, custom metrics, Go metrics middleware |
