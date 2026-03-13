# Logging

Orion uses structured logging across all services for consistent, queryable log output.

## :material-layers: Logging Stack

| Service Type          | Library         | Format |
| --------------------- | --------------- | ------ |
| Go (Gateway, CLI)     | `slog` (stdlib) | JSON   |
| Python (all services) | `structlog`     | JSON   |

## :material-language-go: Go Logging (slog)

The gateway uses Go's built-in `slog` package for structured logging.

### Request Logging Middleware

Every HTTP request is logged with:

| Field         | Type   | Description                      |
| ------------- | ------ | -------------------------------- |
| `method`      | string | HTTP method                      |
| `path`        | string | Request path                     |
| `status`      | int    | Response status code             |
| `duration_ms` | float  | Request duration in milliseconds |
| `request_id`  | string | Unique request ID (X-Request-ID) |

**Example log entry:**

```json
{
  "time": "2024-03-12T10:30:00Z",
  "level": "INFO",
  "msg": "request completed",
  "method": "GET",
  "path": "/api/v1/scout/api/v1/trends",
  "status": 200,
  "duration_ms": 45.2,
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Log Levels

| Level   | Usage                                                  |
| ------- | ------------------------------------------------------ |
| `DEBUG` | Development diagnostics                                |
| `INFO`  | Normal operations (request completed, service started) |
| `WARN`  | Recoverable issues (rate limit hit, retry)             |
| `ERROR` | Failures requiring attention                           |

---

## :material-language-python: Python Logging (structlog)

All Python services use `structlog` for structured logging.

### Configuration

Logging is configured in `libs/orion-common/`:

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
```

### Usage in Services

```python
import structlog

logger = structlog.get_logger(__name__)

async def handle_trend(payload: dict) -> None:
    await logger.ainfo(
        "trend_detected",
        trend_id=payload["trend_id"],
        topic=payload["topic"],
        score=payload["score"],
    )
```

**Example log entry:**

```json
{
  "event": "trend_detected",
  "trend_id": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "AI agents in production",
  "score": 0.87,
  "level": "info",
  "timestamp": "2024-03-12T10:30:00.000000Z",
  "logger": "src.service.trend_service"
}
```

### Contextual Logging

Bind context variables for the duration of a request:

```python
structlog.contextvars.clear_contextvars()
structlog.contextvars.bind_contextvars(
    request_id=request.headers.get("X-Request-ID"),
    user_id=current_user.id,
)
```

All subsequent log calls in the request will include `request_id` and `user_id`.

---

## :material-magnify: Viewing Logs

### Docker Compose

```bash
# All services
docker compose -f deploy/docker-compose.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.yml logs -f scout

# Filter by level (using jq)
docker compose -f deploy/docker-compose.yml logs scout 2>&1 \
  | jq -r 'select(.level == "error")'
```

### Correlating Requests

Use the `X-Request-ID` header to trace a request across services:

```bash
# Find all logs for a specific request
docker compose -f deploy/docker-compose.yml logs 2>&1 \
  | jq -r 'select(.request_id == "550e8400-e29b-41d4-a716-446655440000")'
```

## :material-alert: Log Aggregation

For production, consider forwarding logs to a centralized system:

| Solution       | Integration                               |
| -------------- | ----------------------------------------- |
| Loki + Grafana | Docker logging driver or Promtail sidecar |
| ELK Stack      | Filebeat sidecar                          |
| CloudWatch     | AWS logging driver                        |
| Datadog        | Datadog agent                             |

!!! tip "Structured JSON is key"
Both slog and structlog output JSON by default, making logs easily parseable by any log aggregation system.
