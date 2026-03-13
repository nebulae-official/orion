# Adding Services

How to create a new Python FastAPI microservice in the Orion platform.

## :material-numeric-1-circle: Create the Service Directory

```bash
mkdir -p services/myservice/src/{routes,service,repository}
mkdir -p services/myservice/tests
```

## :material-numeric-2-circle: Create `pyproject.toml`

```toml
[build-system]
requires = ["setuptools>=70.0"]
build-backend = "setuptools.build_meta"

[project]
name = "orion-myservice"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.34.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "structlog>=24.0.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "orion-common",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "httpx>=0.28",
    "ruff>=0.8",
    "mypy>=1.13",
]
```

## :material-numeric-3-circle: Create the FastAPI App

`services/myservice/src/main.py`:

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.event_bus import EventBus

logger = structlog.get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start event bus on startup, close on shutdown."""
    bus = EventBus(settings.redis_url)
    app.state.event_bus = bus
    await bus.start_listening()
    await logger.ainfo("myservice_started", port=8007)
    yield
    await bus.close()


app = FastAPI(
    title="Orion MyService",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "myservice"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}
```

## :material-numeric-4-circle: Add Routes

`services/myservice/src/routes/myroute.py`:

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/myservice", tags=["myservice"])


class MyResponse(BaseModel):
    message: str


@router.get("/", response_model=MyResponse)
async def get_items() -> MyResponse:
    return MyResponse(message="Hello from MyService")
```

Mount in `main.py`:

```python
from .routes.myroute import router as myroute_router

app.include_router(myroute_router)
```

## :material-numeric-5-circle: Register in the Gateway

Add the service URL to `pkg/config/config.go`:

```go
MyServiceURL string `env:"MYSERVICE_URL" envDefault:"http://localhost:8007"`
```

Add the proxy route in `internal/gateway/router/router.go`:

```go
r.Route("/api/v1/myservice", func(r chi.Router) {
    r.Use(authMiddleware)
    r.Handle("/*", proxy.New(cfg.MyServiceURL))
})
```

## :material-numeric-6-circle: Add to Docker Compose

In `deploy/docker-compose.yml`:

```yaml
myservice:
  build:
    context: ../services/myservice
  ports:
    - "8007:8007"
  env_file: ../.env
  networks:
    - orion-net
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8007/health"]
    interval: 30s
    timeout: 5s
    retries: 3
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

## :material-numeric-7-circle: Add Event Subscriptions

If your service needs to listen for events:

```python
async def handle_content_created(payload: dict) -> None:
    logger.info("content_created", content_id=payload["content_id"])


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bus = EventBus(settings.redis_url)
    await bus.subscribe("orion.content.created", handle_content_created)
    await bus.start_listening()
    app.state.event_bus = bus
    yield
    await bus.close()
```

## :material-check-circle: Checklist

- [ ] Service follows the repository pattern (routes -> service -> repository)
- [ ] All function signatures have type hints
- [ ] Pydantic models for all request/response bodies
- [ ] Health (`/health`) and readiness (`/ready`) endpoints
- [ ] structlog for logging (not stdlib)
- [ ] Tests in `tests/` with 80%+ coverage target
- [ ] Registered in gateway router
- [ ] Added to Docker Compose
- [ ] Added to Prometheus scrape config
