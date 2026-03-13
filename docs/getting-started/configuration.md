# Configuration

Orion uses environment variables for all configuration across every layer of the stack — the Go gateway, Python services, dashboard, and infrastructure. Copy `.env.example` to `.env` and adjust values as needed. In Docker Compose, variables are loaded automatically from the `.env` file at the project root.

```bash
# Create your local configuration
cp .env.example .env

# Edit with your preferred editor
$EDITOR .env
```

## :material-cog: Gateway Configuration

The Go gateway reads configuration from environment variables via `pkg/config/config.go`:

| Variable            | Default                           | Description                                               |
| ------------------- | --------------------------------- | --------------------------------------------------------- |
| `APP_ENV`           | `development`                     | Environment mode (`development`, `staging`, `production`) |
| `GATEWAY_PORT`      | `8000`                            | HTTP listen port                                          |
| `ORION_JWT_SECRET`  | `dev-secret-change-in-production` | JWT signing key (HS256)                                   |
| `ORION_ADMIN_USER`  | `admin`                           | Default admin username                                    |
| `ORION_ADMIN_PASS`  | `orion_dev`                       | Default admin password                                    |
| `ORION_ADMIN_EMAIL` | `admin@orion.local`               | Admin email address                                       |

!!! danger "Change the JWT secret in production"
The default `dev-secret-change-in-production` value must be replaced with a strong, random secret before deploying. Generate one with:

    ```bash
    openssl rand -base64 64
    ```

## :material-connection: Service URLs

The gateway proxies requests to Python services using these URLs. Each variable maps to one of the six downstream microservices:

| Variable        | Default                 | Service                           |
| --------------- | ----------------------- | --------------------------------- |
| `SCOUT_URL`     | `http://localhost:8001` | Scout (trend detection)           |
| `DIRECTOR_URL`  | `http://localhost:8002` | Director (pipeline orchestration) |
| `MEDIA_URL`     | `http://localhost:8003` | Media (image generation)          |
| `EDITOR_URL`    | `http://localhost:8004` | Editor (video rendering)          |
| `PULSE_URL`     | `http://localhost:8005` | Pulse (analytics)                 |
| `PUBLISHER_URL` | `http://localhost:8006` | Publisher (social publishing)     |

In Docker Compose, these automatically resolve to container hostnames:

```env
# Docker Compose (default in deploy/docker-compose.yml)
SCOUT_URL=http://scout:8001
DIRECTOR_URL=http://director:8002
MEDIA_URL=http://media:8003
EDITOR_URL=http://editor:8004
PULSE_URL=http://pulse:8005
PUBLISHER_URL=http://publisher:8006
```

When running services locally (without Docker), use `localhost` with the appropriate port.

## :material-database: Data Layer

Shared across all Python services via `orion_common.config.CommonSettings`:

| Variable            | Default                  | Description                                |
| ------------------- | ------------------------ | ------------------------------------------ |
| `POSTGRES_HOST`     | `localhost`              | PostgreSQL host                            |
| `POSTGRES_PORT`     | `5432`                   | PostgreSQL port                            |
| `POSTGRES_USER`     | `orion`                  | Database user                              |
| `POSTGRES_PASSWORD` | `orion_dev`              | Database password                          |
| `POSTGRES_DB`       | `orion`                  | Database name                              |
| `REDIS_URL`         | `redis://localhost:6379` | Redis connection URL (pub/sub and caching) |
| `MILVUS_HOST`       | `localhost`              | Milvus vector DB host                      |
| `MILVUS_PORT`       | `19530`                  | Milvus gRPC port                           |

### Verify data layer connectivity

```bash
# PostgreSQL
psql -h localhost -U orion -d orion -c "SELECT 1;"

# Redis
redis-cli -u redis://localhost:6379 ping

# Milvus
curl http://localhost:9091/healthz
```

## :material-brain: AI Infrastructure

| Variable       | Default                  | Description                           |
| -------------- | ------------------------ | ------------------------------------- |
| `OLLAMA_HOST`  | `http://localhost:11434` | Ollama LLM server for text generation |
| `COMFYUI_HOST` | `http://localhost:8188`  | ComfyUI server for image generation   |

### Verify AI infrastructure

```bash
# Check Ollama is running and list available models
curl http://localhost:11434/api/tags

# Check ComfyUI is accessible
curl http://localhost:8188/system_stats
```

### Switch between LOCAL and CLOUD providers at runtime

```bash
# Switch Media to Fal.ai cloud
./bin/orion provider switch media --mode CLOUD --provider fal_ai

# Switch back to local ComfyUI
./bin/orion provider switch media --mode LOCAL --provider comfyui

# View all active providers and their status
./bin/orion provider status
```

## :material-monitor-dashboard: Dashboard

| Variable                  | Default                 | Description                                  |
| ------------------------- | ----------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:8000` | Gateway URL the dashboard uses for API calls |

The dashboard reads this at build time (Next.js public env var). For development, the default works out of the box.

## :material-file-cog: Python Service Settings

Each Python service inherits from `CommonSettings` in `libs/orion-common/`. Settings are loaded via Pydantic's `BaseSettings` with automatic environment variable binding:

```python
from orion_common.config import get_settings

settings = get_settings()  # Cached singleton
print(settings.database_url)  # postgresql+asyncpg://orion:orion_dev@localhost:5432/orion
```

The `database_url` property auto-constructs the async connection string from individual `POSTGRES_*` variables. A `database_url_sync` variant exists for Alembic migrations.

### Override settings per service

Individual services can define additional settings by extending `CommonSettings`:

```python
from orion_common.config import CommonSettings

class ScoutSettings(CommonSettings):
    scan_interval_minutes: int = 30
    min_trend_score: float = 0.5
    max_trends_per_scan: int = 50
```

## :material-rate-limit: Rate Limiting

Per-service rate limits are configured in the gateway router. Limits use Redis-backed sliding windows to ensure consistency across gateway instances.

| Service   | Read Limit | Write Limit |
| --------- | ---------- | ----------- |
| Director  | 100/min    | 20/min      |
| Scout     | 10/min     | —           |
| Pulse     | 60/min     | —           |
| Media     | 60/min     | —           |
| Editor    | 60/min     | —           |
| Publisher | 60/min     | —           |

### Rate limit response headers

Every response from the gateway includes rate limit metadata:

| Header                  | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed in the current window        |
| `X-RateLimit-Remaining` | Requests remaining before throttling                  |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets                 |
| `Retry-After`           | Seconds until retry (only on `429 Too Many Requests`) |

### Example rate-limited response

```bash
curl -i http://localhost:8000/api/v1/scout/api/v1/trends
# HTTP/1.1 429 Too Many Requests
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1710345600
# Retry-After: 45
```
