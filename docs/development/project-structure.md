# Project Structure

Orion is a monorepo containing Go services, Python microservices, a Next.js dashboard, and shared libraries.

## :material-folder-open: Repository Layout

```
orion/
  cmd/
    gateway/              # Go HTTP gateway entry point
      main.go
  internal/
    gateway/              # Gateway internals (not importable externally)
      router/             # Chi router setup, route definitions
      middleware/          # Auth, CORS, logging, rate limiting, metrics
      handler/            # Auth handlers, WebSocket hub
      proxy/              # Reverse proxy to Python services
  pkg/
    config/               # Shared Go configuration
  cli/                    # Python/Typer CLI
    src/
      orion_cli/
        main.py           # Typer app entry point
        client.py         # HTTP client for gateway
        config.py         # Config management (~/.orion/config.toml)
        output.py         # Output formatting (table, JSON, plain)
        commands/          # Command modules
          auth.py          # Authentication (login, logout, whoami)
          system.py        # System health and status
          scout.py         # Trend management
          content.py       # Content lifecycle
          pipeline.py      # Pipeline runs
          publish.py       # Publishing and social accounts
          admin.py         # Admin operations
    tests/
    pyproject.toml
  services/
    scout/                # Trend detection service (:8001)
      src/
        main.py           # FastAPI app entry point
        routes/           # API route handlers
        service/          # Business logic layer
        repository/       # Data access layer
        providers/        # External source providers
      tests/              # pytest tests
      pyproject.toml
    director/             # Pipeline orchestration (:8002)
      src/
        main.py
        routes/
        service/
        graph/            # LangGraph pipeline
          state.py        # OrionState TypedDict
          nodes.py        # Node functions
          edges.py        # Conditional routing
          hitl.py         # HITL interrupt helpers
          builder.py      # Graph factory
        agents/           # AI agents
          script_generator.py
          critique_agent.py
          visual_prompter.py
          analyst.py
      tests/
    media/                # Image generation (:8003)
      src/
        main.py
        routes/
        service/
        providers/        # ComfyUI, Fal.ai providers
      tests/
    editor/               # Video rendering (:8004)
      src/
        main.py
        routes/
        service/
        pipeline/         # TTS, captions, stitcher, subtitles
      tests/
    pulse/                # Analytics (:8005)
      src/
        main.py
        routes/
        service/
        aggregator/       # Event aggregation
      tests/
    publisher/            # Social publishing (:8006)
      src/
        main.py
        routes/
        service/
      tests/
  libs/
    orion-common/         # Shared Python library
      orion_common/
        config.py         # CommonSettings (Pydantic BaseSettings)
        db/
          models.py       # SQLAlchemy models, enums
          session.py      # Async session factory
        events.py         # Event channel constants
        event_bus.py      # Redis pub/sub EventBus
        logging.py        # structlog configuration
  dashboard/              # Next.js admin dashboard (:3000)
    src/
      app/                # App Router pages
      components/         # React components
      lib/                # Utilities, API client
    package.json
    tsconfig.json
  tests/
    e2e/                  # End-to-end tests
      mocks/              # Mock servers for E2E
      test_golden_path.py
      test_auth_flow.py
      test_event_flow.py
      test_error_recovery.py
    benchmark/            # Performance benchmarks
      test_gateway_throughput.py
      test_event_bus_latency.py
      test_db_query_perf.py
      test_pipeline_latency.py
      locustfile.py       # Locust load test
      baselines.json      # Benchmark baselines
  deploy/
    docker-compose.yml    # Main compose file
    docker-compose.dev.yml # Dev overrides
    docker-compose.e2e.yml # E2E test environment
    prometheus.yml        # Prometheus config
    grafana/              # Grafana provisioning
  migrations/             # Alembic migrations
    alembic.ini
    env.py
    versions/             # Migration scripts
  docs/
    TECH_STACK.md         # Version inventory
  .github/
    workflows/
      ci.yml              # CI pipeline
      build.yml           # Build pipeline
  Makefile                # Build, test, lint, and deploy targets
  .env.example            # Environment template
```

## :material-layers: Layer Architecture

Each Python service follows the same layered architecture:

```mermaid
graph TD
    R["Routes\n(FastAPI APIRouter)"] --> S["Service Layer\n(Business Logic)"]
    S --> RP["Repository\n(Data Access)"]
    RP --> DB[("PostgreSQL")]
    S --> EB["EventBus\n(Redis Pub/Sub)"]
    S --> P["Providers\n(External APIs)"]
```

| Layer          | Responsibility                    | Example                      |
| -------------- | --------------------------------- | ---------------------------- |
| **Routes**     | HTTP request handling, validation | `routes/trends.py`           |
| **Service**    | Business logic, orchestration     | `service/trend_service.py`   |
| **Repository** | Database queries, data access     | `repository/trend_repo.py`   |
| **Providers**  | External API integration          | `providers/google_trends.py` |
