# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Orion — Digital Twin Content Agency. Autonomous AI agents detect trends, generate scripts, create media, assemble videos, and publish to social platforms.

## Tech Stack

- **Gateway:** Go 1.24, Chi 5.x, slog
- **CLI:** Python 3.13, Typer, httpx, Rich
- **Services:** Python 3.13, FastAPI 0.115.x, Pydantic 2.10.x, SQLAlchemy 2.0.x
- **Dashboard:** Next.js 15.2, React 19, Tailwind CSS 4.0, TypeScript
- **Infrastructure:** PostgreSQL 17, Redis 7.4, Milvus 2.4, Ollama, ComfyUI
- **Package Management:** UV workspaces (Python), npm (Node.js)

## Architecture

```
Gateway (Go, :8000) → OAuth + JWT auth → reverse proxy → Python services (:8001-8007)
                    ↕ Redis pub/sub (inter-service events)
                    → Identity (:8007) for user/auth management
Dashboard (Next.js, :3000) → Gateway API
CLI (Python/Typer) → Gateway API
```

- `cmd/gateway/` — Go HTTP gateway, single entry point for all external requests. DB-backed multi-user auth with OAuth (GitHub/Google), JWT access tokens (15-min), opaque refresh tokens (30-day). Forwards `X-User-ID`, `X-User-Role`, `X-User-Email` headers to downstream services.
- `cli/` — Python CLI (UV workspace member), shares models with orion-common
- `services/{scout,director,media,editor,pulse,publisher}` — FastAPI microservices
- `services/identity/` — FastAPI user management service (CRUD, OAuth linking, token management)
- `libs/orion-common/` — Shared Python library (models, event bus, health, config, middleware)
- `dashboard/` — Next.js admin dashboard (App Router, Server Components, OAuth login, profile, admin users)
- `deploy/` — Docker Compose files (main, dev, monitoring, e2e)
- `tests/e2e/` — E2E tests with mock AI providers
- `tests/benchmark/` — pytest-benchmark + Locust load tests

**Data flow:** Scout detects trends → Director orchestrates LangGraph pipeline → Media generates images → Editor assembles video (TTS + captions + stitching) → Publisher pushes to social platforms → Pulse tracks metrics. All inter-service communication via Redis pub/sub events; services never call each other directly over HTTP.

## Commands

```bash
# Build & Run
make build              # Build Go gateway binary
make run                # Run gateway locally
make up                 # Docker Compose start all services
make up-dev             # Dev mode with hot reload
make up-full            # Include GPU services (Ollama, ComfyUI)
make down               # Stop all services

# Test
make test               # Go tests
make py-test            # All Python service tests
make cli-test           # CLI tests
make dash-test          # Dashboard tests (Vitest)
make test-all           # Everything (Go + Python + CLI + Dashboard)
make test-e2e           # E2E tests (requires Docker stack)
make bench              # pytest-benchmark suite
make load-test          # Locust load test (web UI at :8089)

# Single test
go test ./internal/gateway/handlers/ -run TestHealth -v
cd services/scout && uv run pytest tests/test_api.py::test_health_endpoint -v
cd cli && uv run pytest tests/test_commands/test_system.py -v
cd dashboard && npx vitest run __tests__/components/service-health.test.tsx

# Lint & Format
make check              # All linters (Go + Python + CLI + Dashboard)
make lint               # golangci-lint
make py-lint            # ruff on all services
make cli-lint           # ruff + mypy on CLI
make py-format          # ruff format on all services
```

## Code Style

### Go
- Chi v5 router; middleware chain: RequestID → Logger → Recoverer → Security → CORS → Metrics → MaxBody
- `context.Context` as first parameter; wrap errors: `fmt.Errorf("context: %w", err)`
- Table-driven tests with `t.Run`

### Python
- Pydantic v2 for all models; type hints on all function signatures
- structlog (not stdlib logging); async I/O with asyncio
- Repository pattern: routes → service → repository → database
- `@pytest_asyncio.fixture` for async fixtures (not `@pytest.fixture`)
- UV for all package management (never pip)

### TypeScript/Next.js
- App Router with Server Components by default; `"use client"` only when needed
- Tailwind CSS utilities only; `cn()` helper for conditional classes
- Server Actions for mutations; strict TypeScript

## Key Patterns

- **Event-driven:** Services communicate via Redis pub/sub channels (e.g., `orion.media.generated`). Event bus is in `libs/orion-common/event_bus.py`.
- **Strategy pattern:** Providers (LLM, image, video, TTS) are swappable LOCAL/CLOUD via factory. See `services/media/src/providers/factory.py`.
- **LangGraph orchestration:** Director uses a StateGraph DAG with agents (Analyst, Critique, ScriptGenerator, VisualPrompter) and PostgreSQL checkpointing.
- **Gateway proxy:** All service requests go through the Go gateway which handles OAuth (GitHub/Google), JWT auth (15-min access tokens), rate limiting, circuit breakers, and reverse proxies to the appropriate service. The gateway forwards `X-User-ID`, `X-User-Role`, and `X-User-Email` headers to downstream services after JWT validation.
- **User context:** Services use `get_current_user()` dependency to extract the authenticated user from gateway-forwarded headers. All user-scoped queries filter by `user_id` for per-user data isolation.
- **Shared client factory:** CLI commands use `get_client()` from `cli/src/orion_cli/commands/__init__.py`, not per-module singletons.
- **DB-dependent tests:** Tests needing PostgreSQL use `@requires_db` skip marker. They run when `DATABASE_URL` is set.

## Agent Teams

Teams are created at runtime with `TeamCreate`. Common patterns for this project:

- **Feature team** — Lead coordinates backend agent (services/) + frontend agent (dashboard/) + test agent. Use for cross-cutting features.
- **Hardening team** — Parallel agents fixing tests, linting, or docs across services independently.
- **Review team** — Code reviewer + test runner validating a PR or branch.

Custom agents in `.claude/agents/`: code-reviewer, test-runner, db-migration, orion-provider, orion-service-scaffold, version-checker.

## Hooks

Configured in `.claude/settings.json`:
- **PostToolUse (Write|Edit):** Auto-formats Python files with `ruff check --fix` + `ruff format`
- **PostToolUse (Bash):** Runs `ruff check` on all Python code before git commits
- **Stop:** Reminds to run `make test-all` before pushing

## Commit Format

`feat(ORION-{id}): {description}` — Types: feat, fix, docs, refactor, test, chore.

## Warnings

- Do NOT commit .env files — use .env.example as template
- Do NOT modify files in .overstory/
- Services communicate via Redis pub/sub, NOT direct HTTP between services
- Gateway is the single entry point for external requests
- Use UV (not pip) for all Python package management
