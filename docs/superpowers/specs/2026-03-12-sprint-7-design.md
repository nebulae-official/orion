# Sprint 7: LangGraph Persistence, Feedback Loop & Cross-Cutting Concerns

**Goal:** Extend the LangGraph pipeline with PostgreSQL checkpointing, the Analyst node, a cyclic feedback loop, Gateway rate limiting, and Prometheus metrics across all services.

**Architecture:** Sprint 6 built a two-node LangGraph graph (Strategist → Creator) with optional HITL gates but no persistence. Sprint 7 adds state persistence via PostgreSQL checkpointing, completes the FRD's three-node architecture by adding the Analyst node, closes the feedback loop (Analyst → Strategist cycle-back), and adds cross-cutting concerns (rate limiting, observability).

**Tech Stack:** LangGraph 1.x + langgraph-checkpoint-postgres, Go Chi middleware + go-redis, prometheus_client (Python) + prometheus/client_golang (Go)

**References:**
- FRD: Confluence "00c. Functional Requirements (FRD)" — §4 Analyst Node, §5 State Management
- BRD: Confluence "00b. Business Requirements (BRD)" — §4 Report/Suggest/Auto-Correct
- API Reference: Confluence "06. API Reference" — Rate Limiting table
- Monitoring: Confluence "07. Monitoring & Observability" — Prometheus metrics spec

---

## JIRA Tickets

| Ticket | Summary | Epic |
|--------|---------|------|
| ORION-76 | LangGraph checkpointing with PostgreSQL | ORION-69 (LangGraph) |
| ORION-77 | Analyst node (performance feedback) | ORION-69 (LangGraph) |
| ORION-78 | Feedback loop: Analyst → Strategist cycle-back | ORION-69 (LangGraph) |
| ORION-79 | Gateway rate limiting | (standalone) |
| ORION-80 | Prometheus metrics on all services | ORION-71 (Observability) |

---

## 1. ORION-76: PostgreSQL Checkpointing

### Problem

The LangGraph graph currently runs in-memory with no checkpointer. If the Director service restarts mid-pipeline, all in-flight content processing is lost. HITL gates cannot survive long wait periods (hours/days).

### Design

Use `AsyncPostgresSaver` from `langgraph-checkpoint-postgres` (already in `pyproject.toml`) connected to the same PostgreSQL instance used by the Director.

### Changes

**`services/director/src/main.py` (lifespan):**
- Import `AsyncPostgresSaver` from `langgraph.checkpoint.postgres.aio`
- Initialize checkpointer using `settings.database_url` (converted from SQLAlchemy async URL to raw psycopg format)
- Call `await checkpointer.setup()` to create checkpoint tables on startup
- Pass `checkpointer=checkpointer` to `build_content_graph()`
- Flip `enable_hitl=True` (now safe with persistence)
- Close checkpointer connection pool on shutdown

**`services/director/src/services/pipeline.py`:**
- `run()`: Always generate a `thread_id = str(uuid.uuid4())` if not provided, pass in config
- `run()`: Return `thread_id` in result dict so the API can expose it for HITL resume
- Add `cleanup_checkpoints(thread_id)` method that deletes checkpoint data after terminal state
- Call cleanup after successful completion and after confirmed failure

**`services/director/src/schemas.py`:**
- Add `thread_id: str | None = None` to `GenerateContentResponse`

### Connection String Conversion

`AsyncPostgresSaver` uses raw `psycopg` connection strings, not SQLAlchemy URLs. The lifespan must convert:
```
postgresql+asyncpg://user:pass@host/db  →  postgresql://user:pass@host/db
```
A simple string replacement: strip the `+asyncpg` suffix.

### Checkpoint Cleanup

Old checkpoints consume storage. Cleanup triggers:

1. After pipeline reaches terminal state (COMPLETE or FAILED) in `run()`
2. After HITL resume reaches terminal state in `resume()`

**Implementation:** Use raw SQL delete against LangGraph's checkpoint tables. `AsyncPostgresSaver` creates tables named `checkpoints` and `checkpoint_writes` (keyed by `thread_id`). The cleanup method executes:

```sql
DELETE FROM checkpoint_writes WHERE thread_id = $1;
DELETE FROM checkpoints WHERE thread_id = $1;
```

This is coupled to LangGraph's internal schema but is the only reliable cleanup path — the `BaseCheckpointSaver` interface does not expose a public delete method. If the table names change in a future LangGraph version, the cleanup SQL must be updated.

---

## 2. ORION-77: Analyst Node

### Problem

The FRD specifies a three-node architecture (Strategist → Creator → Analyst), but Sprint 6 only implemented two nodes. The Analyst node is responsible for performance analysis, benchmark comparison, and generating improvement suggestions.

### Design

The Analyst node runs as a LangGraph graph node in the Director service, using shared PostgreSQL tables (via orion-common models) for performance data. No HTTP calls to Pulse — this respects the "no direct HTTP between services" rule and avoids network overhead.

### Data Access Strategy

The Analyst queries these shared tables (defined in `orion_common.db.models`):

- `PipelineRun`: Pipeline duration derived from `completed_at - started_at`, success/failure rates per content. Note: this gives total pipeline duration, not per-stage breakdown (each `PipelineRun` record represents one pipeline execution, not individual stages).
- `Content`: Historical content with statuses, hooks, script bodies for pattern analysis across the same niche.

**Not in scope:** Cost data. The Pulse service stores costs in its own `costs` table which is not defined in `orion_common.db.models`. Cost analysis will be added when the cost model is promoted to the shared library.

For benchmark comparison, the Analyst queries the last 30 days of completed content in the same niche (via `Content` table filtered by niche and status).

### New Files

**`services/director/src/agents/analyst.py`** — `AnalystAgent` class:

```python
class ImprovementSuggestion(BaseModel):
    area: str          # "hook", "body", "cta", "visuals"
    suggestion: str
    expected_impact: str  # "high", "medium", "low"
    rationale: str

class AnalysisResult(BaseModel):
    performance_summary: str
    benchmark_comparison: dict[str, Any]
    suggestions: list[ImprovementSuggestion]
    overall_score: float  # 0.0 - 1.0

class AnalystAgent:
    def __init__(self, llm_provider: LLMProvider) -> None: ...

    async def analyze(
        self,
        session: AsyncSession,
        content_id: UUID,
        niche: str,
        script_hook: str,
        script_body: str,
        critique_score: float,
    ) -> AnalysisResult: ...
```

**Processing steps** (per FRD §4):
1. **Data Aggregation**: Query `PipelineRun` for this content's stage durations
2. **Metric Calculation**: Compute total pipeline latency, cost, critique score
3. **Benchmark Comparison**: Query avg latency, avg score, avg cost for same niche over last 30 days
4. **Pattern Detection + Insight Generation**: LLM call with performance context → structured suggestions
5. **Recommendation Formulation**: Return prioritized `ImprovementSuggestion` list

### OrionState Additions

```python
# --- Analyst outputs (new fields) ---
performance_summary: NotRequired[str]
improvement_suggestions: NotRequired[list[dict[str, Any]]]
analyst_score: NotRequired[float]  # Overall pipeline quality score (0.0-1.0), distinct from critique_score which is the CritiqueAgent's confidence score
```

**Naming clarification:** The existing `critique_score` field (set by the Strategist node's CritiqueAgent) measures script quality confidence. The new `analyst_score` measures overall pipeline performance quality. These are distinct metrics. The existing misleading comment `# --- Analyst outputs (optional) ---` above `critique_score`/`critique_feedback` in `state.py` should be renamed to `# --- Critique outputs (optional) ---` during implementation.

### Graph Node

**`services/director/src/graph/nodes.py`** — add `analyst_node()`:

```python
async def analyst_node(
    state: OrionState,
    *,
    analyst_agent: AnalystAgent,
    session_factory: Callable,
) -> dict[str, Any]:
```

The node needs a DB session to query performance data. Unlike strategist/creator nodes (which don't need DB access), the analyst node requires a `session_factory` (an async context manager that yields `AsyncSession`). This is bound via `functools.partial` in the builder, same pattern as other agent dependencies.

### HITL Gate

**`analyst_hitl_gate(state)`** — pauses for human review of improvement suggestions:

- Payload includes: performance summary, benchmark comparison, suggestions list, overall score
- Approved → proceed to feedback loop or END
- Rejected → mark as COMPLETE (no improvements applied)

**Payload builder:** Add `build_analyst_review_payload(state)` in `hitl.py`, following the existing pattern of `build_strategist_review_payload()` and `build_creator_review_payload()`.

---

## 3. ORION-78: Feedback Loop (Analyst → Strategist Cycle-Back)

### Problem

The FRD §5 state transition table specifies `ANALYST_HITL → FEEDBACK_LOOP → STRATEGIST_RUNNING`. When the analyst's improvement suggestions are approved, the graph should cycle back to the Strategist to regenerate content with the suggestions applied.

### Design

Add `iteration_count` and `max_iterations` to `OrionState`. A conditional edge after the analyst HITL gate routes back to `"strategist"` when suggestions are approved and iteration limit isn't reached.

### OrionState Additions

```python
iteration_count: NotRequired[int]   # starts at 0, incremented by strategist on re-entry
max_iterations: NotRequired[int]    # default 3, set at pipeline start
```

### Graph Topology (Full, with HITL enabled)

```
START → strategist → strategist_review → creator → creator_review → analyst → analyst_review ─┐
             ↑                                                                                  │
             └──────────────── (approved + iterations < max) ───────────────────────────────────┘
                                                                    │
                                                              (else) → END
```

### New Edge Function

```python
def route_after_analyst_hitl(state: OrionState) -> str:
    """Route after analyst HITL gate. Cycles back to strategist if approved
    and iteration limit not reached, otherwise END."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    # Guard: if no HITL decisions exist, do not cycle back
    decisions = state.get("hitl_decisions", [])
    if not decisions:
        return END
    last = decisions[-1]
    if not last.get("approved", False):  # default False — absent approval = no cycle
        return END
    count = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", 3)
    if count < max_iter:
        return "strategist"
    return END
```

### Strategist Node Changes

When `improvement_suggestions` exist in state (i.e., this is a feedback loop iteration, not the first run):
1. The `ScriptRequest` prompt includes the suggestions as additional context
2. `iteration_count` is incremented in the returned state update
3. Previous script is available in state for reference

### Audit Trail

- Each iteration's HITL decisions accumulate via the `operator.add` reducer on `hitl_decisions`
- The PostgreSQL checkpointer stores every state snapshot at every node transition
- Full rollback to any previous iteration is possible via checkpoint history API
- No additional audit table needed — the checkpointer IS the audit trail

### New Edge Function for Non-HITL Path

The existing `route_after_creator` in `edges.py` unconditionally returns `END`. With the Analyst added, this must be updated:

```python
def route_after_creator(state: OrionState) -> str:
    """Route after creator. With Analyst node, routes to 'analyst' on success, END on failure."""
    if state.get("current_stage") == PipelineStage.FAILED:
        return END
    return "analyst"

def route_after_analyst(state: OrionState) -> str:
    """Route after analyst (non-HITL path). Always routes to END."""
    return END
```

### Builder Changes

**`services/director/src/graph/builder.py`:**

- Add `analyst` node and `analyst_review` HITL gate node
- Add edge: `creator_review → analyst` (HITL path) or `creator → analyst` (non-HITL path via updated `route_after_creator`)
- Add conditional edge after `analyst_review`: routes to `strategist` or `END` (via `route_after_analyst_hitl`)
- Add edge after `analyst`: routes to `END` (non-HITL path via `route_after_analyst`)
- **HITL-disabled path:** `START → strategist → creator → analyst → END` (linear, no gates). Uses `route_after_creator` (now routes to `"analyst"` instead of `END`) and `route_after_analyst` (routes to `END`).
- **HITL-enabled path:** Full topology with all three gates and feedback loop cycle.

### Event Publishing in Feedback Loop

When the pipeline cycles back (iteration > 0), the `CONTENT_CREATED` event must NOT be re-published. Events should only fire on the **final** completion:

- `pipeline.py` publishes `CONTENT_CREATED` only when `iteration_count >= max_iterations` or when the analyst HITL gate rejects (no cycle-back)
- Intermediate iterations are internal graph state — downstream subscribers (Pulse, etc.) should not see them

### Pipeline.run() Changes

- Set `max_iterations=3` and `iteration_count=0` in initial state
- Return `iteration_count` and `thread_id` in result dict

---

## 4. ORION-79: Gateway Rate Limiting

### Problem

The Go Gateway currently accepts unlimited requests on all endpoints. The API Reference (Confluence 06) specifies rate limits per endpoint group.

### Design

Redis-backed sliding window counter implemented as Chi middleware. Applied per route group with different limits.

### Algorithm: Sliding Window Counter

```
Key: ratelimit:{group}:{identifier}:{window_start}
```

1. On request, compute current window key (truncate timestamp to minute boundary)
2. `INCR` the key, `EXPIRE` with 2× window duration
3. Sum current window count + weighted previous window count
4. If sum > limit, return 429

Identifier: IP address for unauthenticated endpoints. When auth is implemented, switch to user ID.

### Rate Limit Groups (from API Reference)

| Group | Limit | Window | Route Pattern |
|-------|-------|--------|---------------|
| auth | 5 | 1 min | `/api/v1/auth/*` |
| content_read | 100 | 1 min | `GET /api/v1/content/*` |
| content_write | 20 | 1 min | `POST/PUT/DELETE /api/v1/content/*` |
| triggers | 10 | 1 min | `/api/v1/trigger/*` |
| system | 60 | 1 min | `/api/v1/system/*`, `/api/v1/providers/*`, `/api/v1/analytics/*` |

### New Files

**`internal/gateway/middleware/ratelimit.go`:**

```go
type RateLimitConfig struct {
    Group   string
    Limit   int
    Window  time.Duration
}

func RateLimit(rdb *redis.Client, cfg RateLimitConfig) func(http.Handler) http.Handler
```

Returns Chi-compatible middleware. Extracts identifier from request (IP or user ID from context), checks Redis, returns 429 with `Retry-After` header and standard error JSON if exceeded.

**`internal/gateway/middleware/ratelimit_test.go`:**
- Table-driven tests with mock Redis (or miniredis)
- Test cases: under limit, at limit, over limit, different groups, Retry-After header correctness

### Router Integration

**Current state:** The router uses a flat service-name-based proxy pattern (`/api/v1/{service}/*`) that forwards to backend service URLs. There are no semantic route groups like `/api/v1/content` or `/api/v1/auth` — content routes live under `/api/v1/director/*`.

**Approach:** Add rate limiting at the service proxy level, mapping API Reference groups to service routes. The rate limiter middleware inspects the request method and path to determine which group applies:

**`internal/gateway/router/router.go`:**

```go
// Rate limiting applied per service proxy with method-aware grouping
r.Route("/api/v1/director", func(r chi.Router) {
    r.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
        Group: "content_write", Limit: 20, Window: time.Minute,
    })).Post("/*", directorProxy)
    r.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
        Group: "content_read", Limit: 100, Window: time.Minute,
    })).Get("/*", directorProxy)
})

r.Route("/api/v1/scout", func(r chi.Router) {
    r.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
        Group: "triggers", Limit: 10, Window: time.Minute,
    }))
    r.Handle("/*", scoutProxy)
})

r.Route("/api/v1/pulse", func(r chi.Router) {
    r.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
        Group: "system", Limit: 60, Window: time.Minute,
    }))
    r.Handle("/*", pulseProxy)
})
```

This replaces the current flat `serviceProxy(name, url)` pattern with explicit per-service route groups. Auth routes (`/api/v1/auth/*`) will be added when the auth system is implemented; until then, the auth rate limit group is defined but not mounted.

### Response Format

```json
{
    "error": {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Rate limit exceeded for content_write. Try again in 42s.",
        "status": 429
    }
}
```

Headers: `Retry-After: 42`, `X-RateLimit-Limit: 20`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: 1741795260`

### Dependencies

- `go-redis/redis/v9` — already in go.mod
- No new Go dependencies needed

---

## 5. ORION-80: Prometheus Metrics

### Problem

All services have a placeholder `/metrics` endpoint returning empty JSON. The Monitoring doc (Confluence 07) specifies detailed Prometheus metrics. Prometheus + Grafana are already configured in `deploy/docker-compose.monitoring.yml` but have nothing to scrape.

### Design

Real Prometheus client libraries replacing the placeholder. Auto-instrumented HTTP metrics on all services, plus custom pipeline metrics on the Director.

### Scope for Sprint 7

**In scope:**
- Service-level HTTP metrics (auto-instrumented): `orion_requests_total`, `orion_request_duration_seconds`, `orion_active_connections`
- Director pipeline metrics: `orion_content_total`, `orion_content_generation_duration_seconds`, `orion_content_confidence_score`

**Deferred (requires provider-level changes):**
- Provider metrics (`orion_provider_*`) — requires changes inside each provider strategy
- GPU metrics (`orion_gpu_*`) — requires nvidia-smi integration
- Trend metrics (`orion_trends_*`) — Scout service, separate sprint

### Go Gateway

**New dependency:** `github.com/prometheus/client_golang`

**New file: `internal/gateway/middleware/metrics.go`:**
- Middleware that records request count, duration histogram, active connections gauge
- Labels: `method`, `path`, `status_code`

**Router change:** Mount `promhttp.Handler()` at `/metrics`, add metrics middleware to global chain.

### Python Services (orion-common)

**New dependency in `libs/orion-common/pyproject.toml`:** `prometheus-fastapi-instrumentator>=7.0.0`

**`libs/orion-common/orion_common/health.py` changes:**

The placeholder `/metrics` endpoint in `create_health_router()` returns a JSON dict, but Prometheus requires its own text format served via a dedicated ASGI app. Since `APIRouter` endpoints cannot serve raw ASGI apps, the `/metrics` endpoint must be mounted at the **app level**, not the router level.

Changes:

- Remove the placeholder `/metrics` route from `create_health_router()`
- Add `instrument_app(app: FastAPI, service_name: str)` as a standalone function that:
  1. Attaches `prometheus-fastapi-instrumentator` to the FastAPI app (auto-instruments all routes)
  2. Sets the `service` label on all default metrics
  3. Exposes `/metrics` via the instrumentator's built-in endpoint (which handles Prometheus text format correctly)

The instrumentator's `.expose()` method mounts at the app level internally, avoiding the APIRouter limitation.

**Usage in each service's `main.py`:**

```python
from orion_common.health import instrument_app

# After app creation and router mounting:
instrument_app(app, service_name="director")
```

### Director Custom Metrics

**`services/director/src/metrics.py`** (new file):
```python
from prometheus_client import Counter, Histogram

CONTENT_TOTAL = Counter(
    "orion_content_total", "Content items by status", ["status"]
)
GENERATION_DURATION = Histogram(
    "orion_content_generation_duration_seconds",
    "Time per pipeline stage",
    ["stage"],
    buckets=[1, 5, 10, 30, 60, 120, 300],
)
CONFIDENCE_SCORE = Histogram(
    "orion_content_confidence_score",
    "Distribution of critique confidence scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)
```

Instrumentation points in `pipeline.py`:
- `CONTENT_TOTAL.labels(status="generating").inc()` at pipeline start
- `GENERATION_DURATION.labels(stage="strategist").observe(duration)` after each node
- `CONFIDENCE_SCORE.observe(critique_score)` after strategist completes

---

## Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Analyst queries shared DB tables | HTTP to Pulse, Redis event-driven | No network overhead; respects "no direct HTTP" rule; models already shared in orion-common |
| 2 | AsyncPostgresSaver for checkpointing | SQLite, Redis, custom | Already in pyproject.toml deps; uses same PostgreSQL; auto-creates tables |
| 3 | Enable HITL with persistence | Keep disabled | Checkpointer makes HITL production-safe; this is the whole point of ORION-76 |
| 4 | max_iterations=3 for feedback loop | 1, 5, configurable | Conservative default; FRD doesn't specify; prevents runaway cycles |
| 5 | Sliding window counter for rate limiting | Token bucket, fixed window, leaky bucket | Simple Redis implementation; smooths burst edges; matches API Reference spec |
| 6 | prometheus-fastapi-instrumentator for Python | Raw prometheus_client, starlette-exporter | Auto-instruments all endpoints; widely adopted; minimal boilerplate |
| 7 | prometheus/client_golang for Go | VictoriaMetrics client, custom | Official library; industry standard; already used by Prometheus ecosystem |
| 8 | Defer provider/GPU/trend metrics | Implement all metrics now | Provider metrics require changes inside each strategy; GPU requires nvidia-smi; keeps sprint focused |
| 9 | Session factory for Analyst node | Pass session directly, create new connection | Graph nodes are pure functions; session factory allows node to manage its own transaction scope |
| 10 | No Alembic migration for checkpoints | Add migration | AsyncPostgresSaver.setup() creates its own tables; managed by LangGraph, not our schema |

---

## Non-Functional Requirements

| Requirement | Target | Source |
|-------------|--------|--------|
| Strategist P95 latency | < 10s | FRD §7 |
| Creator P95 latency | < 60s | FRD §7 |
| Analyst P95 latency | < 30s | FRD §7 |
| State persistence | < 100ms | FRD §7 |
| HITL notification | < 5s | FRD §7 |
| Rate limit check latency | < 5ms | Derived (Redis INCR) |
| Metrics scrape | < 1s | Prometheus 15s interval |

---

## Assumptions

1. Redis is available for rate limiting (already required by EventBus)
2. `prometheus-fastapi-instrumentator` v7+ supports Python 3.13
3. LangGraph 1.x `AsyncPostgresSaver.setup()` is idempotent (safe to call on every startup)
4. Go Gateway will use `go-redis` v9 which is already in go.mod
5. The FRD's "Auto-Correct" (BRD §4.3) is satisfied by the feedback loop — no separate auto-correction system needed
6. Cost data is out of scope for the Analyst in Sprint 7 (cost model not in orion-common shared models yet)
