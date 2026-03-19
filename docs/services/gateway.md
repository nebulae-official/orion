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

| Method | Path                                      | Description                                       |
| ------ | ----------------------------------------- | ------------------------------------------------- |
| `GET`  | `/health`                                 | Liveness probe                                    |
| `GET`  | `/ready`                                  | Readiness probe (checks downstream services)      |
| `GET`  | `/metrics`                                | Prometheus metrics                                |
| `POST` | `/api/v1/auth/login`                      | Authenticate with email/password                  |
| `POST` | `/api/v1/auth/register`                   | Register a new user account                       |
| `POST` | `/api/v1/auth/refresh`                    | Refresh access token using refresh token          |
| `POST` | `/api/v1/auth/forgot-password`            | Initiate password reset via email                 |
| `POST` | `/api/v1/auth/reset-password`             | Complete password reset with token                |
| `POST` | `/api/v1/auth/verify-email`               | Verify email address with token                   |
| `GET`  | `/api/v1/auth/oauth/github`               | Initiate GitHub OAuth flow                        |
| `GET`  | `/api/v1/auth/oauth/github/callback`      | GitHub OAuth callback                             |
| `GET`  | `/api/v1/auth/oauth/google`               | Initiate Google OAuth flow                        |
| `GET`  | `/api/v1/auth/oauth/google/callback`      | Google OAuth callback                             |
| `GET`  | `/ws`                                     | WebSocket upgrade (JWT via `?token=` query param) |

### Protected Endpoints (JWT required)

| Pattern                | Target Service | Target Port |
| ---------------------- | -------------- | ----------- |
| `/api/v1/scout/*`      | Scout          | 8001        |
| `/api/v1/director/*`   | Director       | 8002        |
| `/api/v1/media/*`      | Media          | 8003        |
| `/api/v1/editor/*`     | Editor         | 8004        |
| `/api/v1/pulse/*`      | Pulse          | 8005        |
| `/api/v1/publisher/*`  | Publisher      | 8006        |
| `/api/v1/identity/*`   | Identity       | 8007        |

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

The gateway implements DB-backed multi-user auth with OAuth (GitHub/Google), 15-minute JWT access tokens, and 30-day opaque refresh tokens with rotation.

### User Header Forwarding

After JWT validation, the gateway injects the following headers into proxied requests so downstream services can identify the authenticated user without re-validating the token:

| Header         | Value                | Example                                |
| -------------- | -------------------- | -------------------------------------- |
| `X-User-ID`    | User UUID from `sub` | `550e8400-e29b-41d4-a716-446655440000` |
| `X-User-Role`  | User role            | `admin`, `user`                        |
| `X-User-Email` | User email           | `admin@orion.local`                    |

### Token Design

| Token          | Format     | Lifetime | Storage        |
| -------------- | ---------- | -------- | -------------- |
| Access token   | JWT (HS256)| 15 min   | Client memory  |
| Refresh token  | Opaque     | 30 days  | DB-backed      |

Refresh tokens use rotation with family tracking. If a revoked token is reused, the entire token family is invalidated (theft detection).

=== "Email/Password Login"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@orion.local", "password": "orion_dev"}'
    ```

    Response:

    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "ort_a1b2c3d4e5f6...",
      "token_type": "Bearer",
      "expires_in": 900,
      "user": {
        "id": "uuid",
        "email": "admin@orion.local",
        "name": "Admin",
        "role": "admin"
      }
    }
    ```

=== "OAuth (GitHub)"

    ```bash
    # 1. Redirect user to initiate OAuth
    curl -L http://localhost:8000/api/v1/auth/oauth/github
    # → 302 to https://github.com/login/oauth/authorize?client_id=...&state=...

    # 2. GitHub redirects back to callback with code
    # GET /api/v1/auth/oauth/github/callback?code=xxx&state=yyy
    # → Sets cookies and redirects to dashboard
    ```

=== "Refresh"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/refresh \
      -H "Content-Type: application/json" \
      -d '{"refresh_token": "ort_a1b2c3d4e5f6..."}'
    ```

=== "Register"

    ```bash
    curl -X POST http://localhost:8000/api/v1/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email": "user@example.com", "password": "secure123", "name": "New User"}'
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

| Environment Variable      | Default                           | Description                           |
| ------------------------- | --------------------------------- | ------------------------------------- |
| `GATEWAY_PORT`            | `8000`                            | Listen port                           |
| `ORION_JWT_SECRET`        | `dev-secret-change-in-production` | JWT signing secret (HS256)            |
| `REDIS_URL`               | `redis://localhost:6379`          | Redis for rate limiting and WebSocket |
| `SCOUT_URL`               | `http://localhost:8001`           | Scout service URL                     |
| `DIRECTOR_URL`            | `http://localhost:8002`           | Director service URL                  |
| `MEDIA_URL`               | `http://localhost:8003`           | Media service URL                     |
| `EDITOR_URL`              | `http://localhost:8004`           | Editor service URL                    |
| `PULSE_URL`               | `http://localhost:8005`           | Pulse service URL                     |
| `PUBLISHER_URL`           | `http://localhost:8006`           | Publisher service URL                 |
| `IDENTITY_URL`            | `http://localhost:8007`           | Identity service URL                  |
| `GITHUB_CLIENT_ID`        | --                                | GitHub OAuth app client ID            |
| `GITHUB_CLIENT_SECRET`    | --                                | GitHub OAuth app client secret        |
| `GOOGLE_CLIENT_ID`        | --                                | Google OAuth client ID                |
| `GOOGLE_CLIENT_SECRET`    | --                                | Google OAuth client secret            |
| `OAUTH_REDIRECT_BASE`     | `http://localhost:8000`           | Base URL for OAuth callbacks          |

!!! warning "Deprecated Variables"
    `ORION_ADMIN_USER` and `ORION_ADMIN_PASS` are deprecated. User accounts are now managed through the Identity service with DB-backed credentials. Create the initial admin user via registration or database seeding.
