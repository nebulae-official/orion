# Gateway

The Go gateway is the single entry point for all external requests. It handles authentication, rate limiting, request proxying, and WebSocket connections.

| Property     | Value                               |
| ------------ | ----------------------------------- |
| **Port**     | 8000                                |
| **Language** | Go 1.24                             |
| **Router**   | Chi 5.x                             |
| **Binary**   | `bin/gateway`                       |
| **Source**   | `cmd/gateway/`, `internal/gateway/` |

## :material-sitemap: Route Map

### Public Endpoints

| Method | Path                   | Description                                       |
| ------ | ---------------------- | ------------------------------------------------- |
| `GET`  | `/health`              | Liveness probe                                    |
| `GET`  | `/ready`               | Readiness probe (checks downstream services)      |
| `GET`  | `/metrics`             | Prometheus metrics                                |
| `POST` | `/api/v1/auth/login`   | Authenticate and receive JWT                      |
| `POST` | `/api/v1/auth/refresh` | Refresh an existing JWT                           |
| `GET`  | `/ws`                  | WebSocket upgrade (JWT via `?token=` query param) |

### Protected Endpoints (JWT required)

| Pattern               | Target Service | Target Port |
| --------------------- | -------------- | ----------- |
| `/api/v1/scout/*`     | Scout          | 8001        |
| `/api/v1/director/*`  | Director       | 8002        |
| `/api/v1/media/*`     | Media          | 8003        |
| `/api/v1/editor/*`    | Editor         | 8004        |
| `/api/v1/pulse/*`     | Pulse          | 8005        |
| `/api/v1/publisher/*` | Publisher      | 8006        |

## :material-middleware: Middleware Stack

Applied in order:

1. **RequestID** -- Generates UUID, stores in `X-Request-ID` header and request context
2. **Logger** -- Logs `method`, `path`, `status`, `duration_ms` via `slog`
3. **Recoverer** -- Catches panics, logs stack trace, returns HTTP 500
4. **CORS** -- Allows all origins, methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`)
5. **Metrics** -- Prometheus HTTP request instrumentation
6. **Auth** -- JWT Bearer token validation (HS256) on protected routes
7. **RateLimit** -- Redis-backed per-service sliding window

## :material-key: Authentication

=== "Login"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username": "admin", "password": "orion_dev"}'
    ```

    Response:

    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "token_type": "Bearer",
      "expires_in": 86400,
      "user": {
        "id": "uuid",
        "username": "admin",
        "email": "admin@orion.local",
        "role": "admin"
      }
    }
    ```

=== "Refresh"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/refresh \
      -H "Authorization: Bearer $TOKEN"
    ```

## :material-web: WebSocket

The WebSocket hub subscribes to Redis channels matching `orion.*` and broadcasts events to connected clients.

- **Endpoint:** `GET /ws?token=<jwt>`
- **Ping interval:** 30 seconds
- **Read timeout:** 60 seconds
- **Protocol:** JSON messages matching the Redis event payload structure

## :material-rate-limit: Rate Limiting

Per-service rate limits applied via Redis sliding windows:

| Service   | Read Limit | Write Limit | Group                        |
| --------- | ---------- | ----------- | ---------------------------- |
| Director  | 100/min    | 20/min      | content_read / content_write |
| Scout     | 10/min     | --          | triggers                     |
| Pulse     | 60/min     | --          | system                       |
| Media     | 60/min     | --          | system                       |
| Editor    | 60/min     | --          | system                       |
| Publisher | 60/min     | --          | system                       |

## :material-cog: Configuration

| Environment Variable | Default                           | Description                           |
| -------------------- | --------------------------------- | ------------------------------------- |
| `GATEWAY_PORT`       | `8000`                            | Listen port                           |
| `ORION_JWT_SECRET`   | `dev-secret-change-in-production` | JWT signing secret                    |
| `REDIS_URL`          | `redis://localhost:6379`          | Redis for rate limiting and WebSocket |
| `SCOUT_URL`          | `http://localhost:8001`           | Scout service URL                     |
| `DIRECTOR_URL`       | `http://localhost:8002`           | Director service URL                  |
| `MEDIA_URL`          | `http://localhost:8003`           | Media service URL                     |
| `EDITOR_URL`         | `http://localhost:8004`           | Editor service URL                    |
| `PULSE_URL`          | `http://localhost:8005`           | Pulse service URL                     |
| `PUBLISHER_URL`      | `http://localhost:8006`           | Publisher service URL                 |
