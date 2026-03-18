# Orion Hardening Sprint — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** CLI rewrite, E2E pipeline testing, performance baseline

---

## 1. CLI Rewrite (Python/Typer)

### Summary

Replace the Go/Cobra CLI (`cmd/cli/`, `internal/cli/`) with a Python/Typer CLI at `cli/`. The new CLI is a UV workspace member that shares Pydantic models from `orion-common` and talks exclusively to the Go gateway over HTTP.

### Directory Structure

```
cli/
├── pyproject.toml          # UV workspace member, depends on orion-common
├── src/orion_cli/
│   ├── __init__.py
│   ├── main.py             # Typer app, top-level command groups
│   ├── client.py           # httpx async client wrapper (talks to gateway)
│   ├── config.py           # CLI config (~/.orion/config.toml) + token storage
│   ├── output.py           # Rich console helpers (table, JSON, progress)
│   ├── commands/
│   │   ├── auth.py         # login, logout, whoami, token refresh
│   │   ├── scout.py        # trigger, list-trends, configure niches
│   │   ├── content.py      # list, view, approve, reject, regenerate
│   │   ├── pipeline.py     # status, run, logs (stream via WebSocket)
│   │   ├── publish.py      # accounts, publish, history
│   │   ├── system.py       # health, status, providers, config
│   │   └── admin.py        # seed, cleanup, migrations
│   └── models/             # Re-export from orion-common where possible
└── tests/
    ├── test_commands/
    └── conftest.py         # Mock gateway via httpx respx
```

### Design Decisions

- **Single `client.py`** wraps all gateway HTTP calls. Every command is thin: parse args, call client, format output.
- **Output modes:** `--format table|json|plain` on every command. Default is `table` (Rich), `json` for scripting, `plain` for piping.
- **Exit codes:** 0 success, 1 general error, 2 auth error, 3 connection error.
- **Shell completion:** Typer provides bash/zsh/fish completion automatically.
- **Config:** `~/.orion/config.toml` stores gateway URL and auth token. `orion login` writes the token; all other commands read it.
- **Shared models:** Import Pydantic models from `orion-common` for type-safe API responses.
- **Use cases:** Developer/operator tool, demo-ready, and automation-friendly (JSON output, exit codes, non-interactive mode).

### What Gets Deleted

- `cmd/cli/main.go`
- `internal/cli/` (commands/, client/, output/)
- Related Go test files for the CLI

The Go gateway (`cmd/gateway/`) is unchanged.

### Dependencies

- typer[all] (includes Rich, shell completion)
- httpx (async HTTP client)
- tomli / tomli-w (config file)
- websockets (for log streaming)
- respx (test mocking for httpx)
- orion-common (workspace dependency)

---

## 2. E2E Pipeline Testing

### Summary

Add `tests/e2e/` with pytest tests that validate the full trend-to-publish pipeline against real PostgreSQL + Redis, with mocked AI providers (LLM, ComfyUI, TTS, Fal.ai).

### Directory Structure

```
tests/e2e/
├── conftest.py             # Docker compose lifecycle, service readiness, fixtures
├── mocks/
│   ├── llm_server.py       # FastAPI stub returning deterministic LLM responses
│   ├── comfyui_server.py   # FastAPI stub returning test images
│   ├── tts_server.py       # FastAPI stub returning test audio
│   └── fal_server.py       # FastAPI stub returning test video/images
├── test_golden_path.py     # Happy path: trend -> script -> media -> edit -> publish
├── test_error_recovery.py  # Service failures, Redis disconnects, partial pipeline
├── test_event_flow.py      # Validate Redis pub/sub event chain across services
├── test_auth_flow.py       # Login -> authenticated requests -> token refresh -> logout
└── fixtures/
    ├── sample_trend.json   # Seed data
    ├── test_audio.wav      # Minimal test assets
    └── test_image.png
```

### Mock Strategy

- A `docker-compose.e2e.yml` override replaces AI provider URLs with mock servers.
- Mock servers are tiny FastAPI apps returning deterministic fixtures (static script text, 1x1 PNG, silent WAV).
- Real PostgreSQL, Redis, and the gateway are used — that is where integration bugs hide.

### Test Lifecycle (conftest.py)

1. **Session fixture:** `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d`
2. Poll health endpoints until all services report ready (30s timeout).
3. Seed database with test data.
4. Tests run.
5. `docker compose down -v` on teardown.

### Golden Path Test Validates

1. Scout detects a trend (seeded or triggered via API).
2. Director creates a content pipeline (script + visual prompts).
3. Media generates images (from mock ComfyUI).
4. Editor assembles video (mock TTS + real FFmpeg stitching).
5. Publisher publishes to mock platform.
6. Pulse records metrics for the entire run.

### Design Decisions

- Tests are **not** run in CI by default (too heavy). Separate `make test-e2e` target and optional CI workflow.
- Each test gets a clean DB via transaction rollback or table truncation between tests.
- Mock servers live in `tests/e2e/mocks/`, started as part of the compose override.

### Dependencies

- pytest + pytest-asyncio (existing)
- httpx (existing)
- docker compose (existing infrastructure)

---

## 3. Performance Baseline & Profiling

### Summary

Add benchmarking infrastructure to establish baselines, detect regressions, and profile hot paths. No premature optimization — measurement only.

### Directory Structure

```
tests/benchmark/
├── conftest.py                  # Shared fixtures, timing utilities
├── test_gateway_throughput.py   # Requests/sec through gateway proxy
├── test_event_bus_latency.py    # Redis pub/sub round-trip time
├── test_db_query_perf.py        # Key query execution times
├── test_pipeline_latency.py     # End-to-end pipeline duration (with mocks)
└── locustfile.py                # Locust load test for concurrent users
```

### What Gets Measured

| Metric | Tool | Where |
|--------|------|-------|
| Gateway req/sec & p95 latency | Locust | Gateway endpoints under load |
| Redis pub/sub round-trip | pytest-benchmark | Event bus publish -> receive |
| DB query times | pytest-benchmark | Key repository queries (trends, content, assets) |
| Pipeline end-to-end duration | pytest-benchmark | Full golden path with mocked AI |
| Memory/CPU per service | Docker stats | Captured during load tests |

### Design Decisions

- **Locust** for HTTP load testing — Python-native, fits the stack, scriptable.
- **pytest-benchmark** for micro-benchmarks — integrates with existing pytest, generates comparison reports.
- Baselines stored as `tests/benchmark/baselines.json`. CI can compare against them to flag regressions (optional future step).
- `make bench` target runs benchmarks, `make load-test` runs Locust.
- No optimization work in this sprint. Optimization comes when a number looks bad.

### Dependencies

- locust
- pytest-benchmark

---

## 4. JIRA Tickets

Epics and stories will be created following the existing pattern:

- **EPIC: Hardening Sprint — CLI Rewrite** — stories for scaffold, client, each command group, tests, Go cleanup
- **EPIC: Hardening Sprint — E2E Testing** — stories for mock servers, compose override, golden path, error recovery, event flow, auth flow
- **EPIC: Hardening Sprint — Performance Baseline** — stories for gateway throughput, event bus, DB queries, pipeline latency, Locust load tests

Commit format: `feat(ORION-{id}): {description}`

---

## 5. Makefile Targets

New targets added:

```makefile
cli-dev      # Run CLI in dev mode
cli-test     # Run CLI tests
cli-build    # Build CLI package
test-e2e     # Run E2E tests (requires docker compose)
bench        # Run pytest-benchmark suite
load-test    # Run Locust load tests
```

---

## 6. Priority Order

1. **CLI Rewrite** — only component below 100%, unblocks demo and automation use cases
2. **E2E Pipeline Testing** — validates the full system works as an integrated whole
3. **Performance Baseline** — most meaningful after correctness is proven
