# :lucide-server: Services

Orion is composed of nine distinct components: a Go HTTP gateway that serves as the single entry point, six Python FastAPI microservices that handle the AI content pipeline, a Next.js admin dashboard, and a Python CLI for terminal-based control.

All external traffic enters through the Gateway, which handles authentication, rate limiting, and request proxying. The Python services communicate with each other exclusively through Redis pub/sub events — there are no direct HTTP calls between them. This decoupled architecture allows each service to be developed, tested, deployed, and scaled independently.

## :material-view-grid: Service Map

```mermaid
graph TB
    subgraph Gateway["Go Gateway :8000"]
        direction LR
        AUTH["Auth"]
        PROXY["Reverse Proxy"]
        RATE["Rate Limiter"]
        WSOCK["WebSocket Hub"]
    end

    subgraph Python["Python FastAPI Services"]
        SC["Scout :8001"]
        DR["Director :8002"]
        MD["Media :8003"]
        ED["Editor :8004"]
        PL["Pulse :8005"]
        PB["Publisher :8006"]
    end

    subgraph Clients["Clients"]
        CLI["Python CLI"]
        DASH["Dashboard :3000"]
    end

    CLI --> Gateway
    DASH --> Gateway
    Gateway --> Python
```

## :material-table: Port Assignments

<div class="grid cards" markdown>

-   :lucide-router: **[Gateway](gateway.md)** — Port 8000

    ---

    Go 1.24 / Chi 5.x — HTTP gateway, auth, rate limiting, WebSocket

-   :lucide-radar: **[Scout](scout.md)** — Port 8001

    ---

    Python 3.13 / FastAPI — Trend detection from external sources

-   :lucide-clapperboard: **[Director](director.md)** — Port 8002

    ---

    Python 3.13 / FastAPI + LangGraph — Pipeline orchestration with HITL gates

-   :lucide-image: **[Media](media.md)** — Port 8003

    ---

    Python 3.13 / FastAPI — Image generation (ComfyUI / Fal.ai)

-   :lucide-film: **[Editor](editor.md)** — Port 8004

    ---

    Python 3.13 / FastAPI — Video rendering (TTS, stitching, subtitles)

-   :lucide-bar-chart: **[Pulse](pulse.md)** — Port 8005

    ---

    Python 3.13 / FastAPI — Analytics, cost tracking, pipeline history

-   :lucide-send: **[Publisher](publisher.md)** — Port 8006

    ---

    Python 3.13 / FastAPI — Social media publishing (Twitter, YouTube, TikTok)

-   :lucide-monitor: **[Dashboard](dashboard.md)** — Port 3000

    ---

    TypeScript / Next.js 15.2 — Admin UI with real-time monitoring

-   :lucide-terminal: **[CLI](cli.md)**

    ---

    Python 3.13 / Typer 0.15.x — Terminal interface for the gateway API

</div>

## :material-check-circle: Health Endpoints

Every service exposes standardized health endpoints for container orchestration and monitoring:

| Endpoint       | Purpose                                                           | Auth Required |
| -------------- | ----------------------------------------------------------------- | ------------- |
| `GET /health`  | Liveness probe — confirms the process is running                  | No            |
| `GET /ready`   | Readiness probe — confirms dependencies (DB, Redis) are reachable | No            |
| `GET /metrics` | Prometheus-compatible metrics endpoint                            | No            |

Check all services at once through the CLI:

```bash
orion system health
```

Or use Docker Compose to inspect container health:

```bash
docker compose -f deploy/docker-compose.yml ps
```

## :material-layers: Shared Library

All six Python services depend on `libs/orion-common/`, a shared library that provides cross-cutting concerns:

- **Config** — `CommonSettings` (Pydantic BaseSettings) with automatic environment variable binding and cached singleton access via `get_settings()`
- **Database** — SQLAlchemy 2.0 async engine, session factory, declarative base models, and migration utilities
- **Events** — `EventBus` for Redis pub/sub with typed event schemas and automatic serialization
- **Logging** — Structured JSON logging via structlog, preconfigured with request IDs and service context
- **Models** — Shared database models, enums (`ContentStatus`, `ProviderMode`), and Pydantic schemas used across services

### Install for local development

```bash
cd libs/orion-common
uv pip install -e ".[dev]"
```

## :material-transit-connection-variant: Event-Driven Communication

Services communicate through Redis pub/sub channels. Each event type follows the naming convention `orion.<domain>.<action>`:

| Event                   | Publisher | Subscriber       | Trigger                               |
| ----------------------- | --------- | ---------------- | ------------------------------------- |
| `orion.trend.detected`  | Scout     | Director         | New trend passes scoring threshold    |
| `orion.content.created` | Director  | Media            | LangGraph pipeline produces content   |
| `orion.media.generated` | Media     | Editor           | Images are ready for video assembly   |
| `orion.media.failed`    | Media     | Director         | Image generation failed (retry logic) |
| `orion.video.rendered`  | Editor    | Pulse, Publisher | Video is ready for review/publishing  |

This architecture means you can restart or scale any individual service without affecting the rest of the pipeline — events are buffered in Redis until consumers are available.
