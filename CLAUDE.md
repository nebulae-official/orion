# Orion

Digital Twin Content Agency — autonomous AI agents for content creation and trend analysis.

## Tech Stack
- **Gateway & CLI:** Go 1.24, Chi 5.x router, Cobra 1.9.x CLI, slog logging
- **AI Services:** Python 3.13, FastAPI 0.115.x, Pydantic 2.10.x, SQLAlchemy 2.0.x
- **Dashboard:** Next.js 15.2, React 19, Tailwind CSS 4.0, TypeScript
- **Infrastructure:** PostgreSQL 17, Redis 7.4, Milvus 2.4, Ollama, ComfyUI

## Architecture
- cmd/gateway/ — Go HTTP gateway (port 8000), routes requests to Python services
- cmd/cli/ — Go CLI tool for interacting with the gateway
- services/{scout,director,media,editor,pulse} — Python FastAPI microservices
- libs/orion-common/ — Shared Python library (models, DB, Redis, config, logging)
- dashboard/ — Next.js admin dashboard (port 3000)
- deploy/ — Docker Compose files and infrastructure config

## Commands
- `make build` — Build Go binaries
- `make test` — Run Go tests
- `make lint` — Run golangci-lint
- `docker compose -f deploy/docker-compose.yml up` — Start all services
- `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up` — Dev mode with hot reload

## Code Style
### Go
- Standard library preferred; Chi for routing
- Error returns, no panic; wrap errors with fmt.Errorf("context: %w", err)
- slog for structured logging; context.Context as first parameter
- Table-driven tests with t.Run subtests

### Python
- Pydantic v2 for all data models; type hints required everywhere
- structlog for logging; async I/O with asyncio
- Repository pattern for data access; ruff + black + mypy for linting
- pytest with fixtures; 80%+ coverage target

### TypeScript/Next.js
- App Router (not Pages); Server Components by default
- Tailwind CSS for styling; no CSS modules
- Strict TypeScript; prefer server actions over API routes

## Testing
- Go: `go test ./...` from root
- Python: `cd services/{name} && pytest`
- Dashboard: `cd dashboard && npm test`

## Warnings
- Do NOT commit .env files — use .env.example as template
- Do NOT modify files in .overstory/ or .claude/
- Python services communicate via Redis pub/sub, not direct HTTP calls between services
- Gateway is the single entry point for external requests
