# Sprint 9: JWT Auth, WebSocket & Social Publishing Foundation

> **Goal:** Close ORION-7 (Dashboard UI) with JWT auth + WebSocket real-time updates, and begin ORION-70 (Social Publishing) with a Publisher service scaffold and X/Twitter as the first platform integration.

**Architecture:** Gateway gains JWT auth endpoints and a WebSocket hub fed by Redis pub/sub. A new Publisher microservice (Python/FastAPI) handles social media posting via a Strategy pattern, starting with X/Twitter. Content transitions from `approved` → `published` via the Publisher, emitting `CONTENT_PUBLISHED` events.

**Tech Stack:**
- Go: `golang-jwt/jwt/v5` for JWT, `gorilla/websocket` for WebSocket
- Python: `tweepy` (X API v2), `cryptography` (credential encryption)
- Existing: Redis pub/sub event bus, FastAPI, SQLAlchemy, Pydantic

**References:**
- [dashboard/src/lib/auth.ts](../../dashboard/src/lib/auth.ts) — Dashboard auth flow (login, refresh, session)
- [dashboard/src/middleware.ts](../../dashboard/src/middleware.ts) — Next.js auth middleware
- [dashboard/src/hooks/use-websocket.ts](../../dashboard/src/hooks/use-websocket.ts) — WebSocket client hook
- [internal/gateway/router/router.go](../../internal/gateway/router/router.go) — Gateway router
- [libs/orion-common/orion_common/events.py](../../libs/orion-common/orion_common/events.py) — Event channels

---

## JIRA Stories

| # | Ticket | Summary | Epic | Size |
|---|--------|---------|------|------|
| 1 | ORION-89 | Gateway JWT auth (login, refresh, middleware) | ORION-7 | M |
| 2 | ORION-90 | Gateway WebSocket hub (Redis → WS broadcast) | ORION-7 | M |
| 3 | ORION-91 | Publisher service scaffold + DB models | ORION-70 | M |
| 4 | ORION-92 | X/Twitter provider (OAuth + post + media upload) | ORION-70 | L |
| 5 | ORION-93 | Publishing workflow (approved → published + event) | ORION-70 | M |
| 6 | ORION-94 | Dashboard publish UI (button + status + history) | ORION-70 | M |
| 7 | ORION-95 | Content safety pre-publish stub | ORION-70 | S |

---

## 1. ORION-89: Gateway JWT Authentication

### Problem
Dashboard has a complete auth flow (login page, middleware, token refresh) but the Gateway has no auth endpoints. All API routes are unprotected.

### Design
Single-user system: credentials from environment variables, no database user table.

**New files:**
- `internal/gateway/handlers/auth.go` — Login + Refresh handlers
- `internal/gateway/middleware/auth.go` — JWT validation middleware

**Config additions** (`pkg/config/config.go`):
```go
JWTSecret     string  // from ORION_JWT_SECRET env (default: random for dev)
AdminUsername string  // from ORION_ADMIN_USER (default: "admin")
AdminPassword string  // from ORION_ADMIN_PASS (default: "orion_dev")
AdminEmail    string  // from ORION_ADMIN_EMAIL (default: "admin@orion.local")
```

**Login flow:**
1. `POST /api/v1/auth/login` with `{"username": "...", "password": "..."}`
2. Validate against env var credentials (bcrypt-hashed comparison)
3. Return `{access_token, token_type: "Bearer", expires_in: 86400, user: {id, username, email, role}}`
4. JWT payload: `{sub: "admin", username, email, role: "admin", exp, iat}`

**Refresh flow:**
1. `POST /api/v1/auth/refresh` with `Authorization: Bearer <token>`
2. Validate existing token (must not be expired)
3. Issue new token with fresh `exp`

**Middleware:**
- Applied to all `/api/v1/*` routes except `/api/v1/auth/*`, `/health`, `/ready`, `/metrics`
- Extracts `Authorization: Bearer <token>` header
- Validates signature + expiry
- Sets user info in request context for downstream use

**Router changes:**
```go
// Public routes
r.Post("/api/v1/auth/login", handlers.Login(cfg))
r.Post("/api/v1/auth/refresh", handlers.RefreshToken(cfg))

// Protected routes
r.Group(func(protected chi.Router) {
    protected.Use(middleware.Auth(cfg.JWTSecret))
    // all service proxies move inside this group
})
```

### Changes
- Create `internal/gateway/handlers/auth.go`
- Create `internal/gateway/middleware/auth.go`
- Modify `pkg/config/config.go` — add JWT/admin fields
- Modify `internal/gateway/router/router.go` — add auth routes, wrap proxies
- Add `golang-jwt/jwt/v5` and `golang.org/x/crypto/bcrypt` to `go.mod`

### Testing
- Table-driven tests for login (valid creds, invalid creds, missing fields)
- Table-driven tests for refresh (valid token, expired token, invalid token)
- Middleware tests (no header, invalid header, expired token, valid token)
- Integration test: login → use token → access protected route

---

## 2. ORION-90: Gateway WebSocket Hub

### Problem
Dashboard has a `useWebSocket` hook with auto-reconnect and JSON parsing, but no service provides a WebSocket endpoint. Real-time pipeline updates require pushing events to the browser.

### Design
Gateway subscribes to all `orion.*` Redis pub/sub channels and broadcasts to connected WebSocket clients.

**New files:**
- `internal/gateway/handlers/websocket.go` — WebSocket upgrade + hub

**Hub pattern:**
```
Redis pub/sub → Hub goroutine → [Client1, Client2, ...]
```

1. On Gateway startup, subscribe to `orion.*` Redis channels
2. `GET /ws?token=<jwt>` endpoint: validate JWT from query param, upgrade to WebSocket
3. Hub maintains a map of connected clients
4. When Redis message arrives, broadcast to all clients as JSON:
   ```json
   {"type": "orion.content.created", "payload": {...}, "timestamp": "2026-03-12T10:00:00Z"}
   ```
5. Client disconnect removes from hub map
6. Periodic ping/pong for connection health (30s interval)

**Auth:** JWT validated from `?token=` query parameter (WebSocket can't set headers). Token must be valid and not expired.

**Router addition:**
```go
// WebSocket — inside protected group but uses query-param auth
r.Get("/ws", handlers.WebSocket(hub, cfg.JWTSecret))
```

### Changes
- Create `internal/gateway/handlers/websocket.go`
- Modify `internal/gateway/router/router.go` — add `/ws` route, start hub
- Modify `cmd/gateway/main.go` — initialize hub with Redis subscription
- Add `github.com/gorilla/websocket` to `go.mod`

### Testing
- Hub unit test: register client, broadcast message, verify delivery
- Auth test: reject connection without token, reject expired token
- Integration test: connect WebSocket, publish Redis event, verify received

---

## 3. ORION-91: Publisher Service Scaffold

### Problem
No service exists for social media publishing. Need a new microservice following existing patterns.

### Design

**Service structure:**
```
services/publisher/
├── pyproject.toml
├── Dockerfile
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── schemas.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── publish.py
│   │   └── accounts.py
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── twitter.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── publisher.py
│   │   └── safety.py
│   └── repositories/
│       ├── __init__.py
│       └── publish_repo.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    └── test_publish.py
```

**DB models (in orion-common):**

```python
class SocialAccount(Base):
    __tablename__ = "social_accounts"
    id: Mapped[uuid.UUID]
    platform: Mapped[str]          # "twitter", "youtube", "tiktok"
    display_name: Mapped[str]      # @handle or channel name
    credentials: Mapped[str]       # encrypted JSON blob
    active: Mapped[bool]
    created_at: Mapped[datetime]

class PublishRecord(Base):
    __tablename__ = "publish_records"
    id: Mapped[uuid.UUID]
    content_id: Mapped[uuid.UUID]  # FK to contents
    platform: Mapped[str]
    platform_post_id: Mapped[str | None]  # e.g., tweet ID
    status: Mapped[str]            # "pending", "published", "failed"
    error_message: Mapped[str | None]
    published_at: Mapped[datetime | None]
    created_at: Mapped[datetime]
```

**Key endpoints:**
- `POST /api/v1/publish/` — publish content to specified platforms
- `GET /api/v1/publish/history` — list publish records
- `GET /api/v1/publish/history/{content_id}` — records for specific content
- `POST /api/v1/accounts/` — add social account credentials
- `GET /api/v1/accounts/` — list connected accounts
- `DELETE /api/v1/accounts/{id}` — remove account

**Gateway config:**
- Add `PublisherURL` to `Config` struct (default `http://localhost:8006`)
- Add `"publisher": cfg.PublisherURL` to services map

**Docker Compose:**
- Add publisher service to `docker-compose.yml` and `docker-compose.dev.yml`

### Changes
- Create entire `services/publisher/` directory
- Modify `libs/orion-common/orion_common/db/models.py` — add SocialAccount, PublishRecord
- Modify `pkg/config/config.go` — add PublisherURL
- Modify `internal/gateway/router/router.go` — add publisher proxy
- Modify `deploy/docker-compose.yml` — add publisher service
- Modify `deploy/docker-compose.dev.yml` — add publisher dev config

### Testing
- Health endpoint test
- CRUD tests for social accounts
- Publish endpoint test (mocked provider)
- Repository tests

---

## 4. ORION-92: X/Twitter Provider

### Problem
Need a concrete social media provider implementation. X/Twitter is the simplest starting point (text + media, well-documented API v2).

### Design

**Strategy pattern:**
```python
class SocialProvider(ABC):
    @abstractmethod
    async def publish(self, request: PublishRequest) -> PublishResult: ...

    @abstractmethod
    async def validate_credentials(self) -> bool: ...

    @abstractmethod
    async def get_character_limit(self) -> int: ...

class TwitterProvider(SocialProvider):
    """X API v2 via tweepy AsyncClient."""

    async def publish(self, request: PublishRequest) -> PublishResult:
        # 1. Upload media if present (images/video)
        # 2. Post tweet with text + media_ids
        # 3. Return platform_post_id (tweet ID)

    def get_character_limit(self) -> int:
        return 280
```

**X API v2 operations:**
- `tweepy.AsyncClient` for tweet posting
- Media upload via v1.1 chunked upload endpoint (required for video)
- OAuth 2.0 credentials stored encrypted in `social_accounts` table

**Credential storage:**
```python
# Encrypted JSON blob in social_accounts.credentials
{
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_token_secret": "..."
}
```
Encryption: `cryptography.fernet.Fernet` with key from `ORION_ENCRYPTION_KEY` env var.

**Content formatting:**
- Truncate to 280 chars with ellipsis if needed
- Append hashtags from trend keywords (if space allows)
- Media: attach video or thumbnail image from content's media assets

### Changes
- Create `services/publisher/src/providers/base.py` — abstract SocialProvider
- Create `services/publisher/src/providers/twitter.py` — TwitterProvider
- Create `services/publisher/src/services/crypto.py` — credential encryption helper
- Add `tweepy>=4.14.0` and `cryptography>=42.0.0` to pyproject.toml

### Testing
- Unit test: tweet text formatting (under/over limit, hashtag insertion)
- Unit test: credential encryption/decryption roundtrip
- Mock test: publish flow with mocked tweepy client
- Mock test: media upload with mocked API

---

## 5. ORION-93: Publishing Workflow

### Problem
Content can be `approved` but no code path transitions it to `published`. The `CONTENT_PUBLISHED` Redis channel exists but is never emitted.

### Design

**Flow:**
1. Dashboard sends `POST /api/v1/publisher/publish` with `{content_id, platforms: ["twitter"]}`
2. Publisher service:
   a. Fetches content details from DB (must be in `approved` status)
   b. Runs pre-publish safety check (ORION-95)
   c. For each platform: call provider's `publish()` method
   d. Create `PublishRecord` for each platform result
   e. Update content status to `published` (via DB)
   f. Emit `CONTENT_PUBLISHED` event on Redis with `{content_id, platforms, published_at}`
3. If any platform fails: record error, content stays `approved`, partial publish is OK

**Error handling:**
- Per-platform: if X fails, record error but don't block other platforms
- Safety check failure: reject with 422 and reason
- Content not in `approved` status: reject with 409 Conflict

**Event payload:**
```json
{
    "content_id": "uuid",
    "platforms": ["twitter"],
    "results": [{"platform": "twitter", "post_id": "123", "status": "published"}],
    "published_at": "2026-03-12T10:00:00Z"
}
```

### Changes
- Create `services/publisher/src/services/publisher.py` — orchestration logic
- Modify `services/publisher/src/routes/publish.py` — POST endpoint
- Content status update via shared DB (orion-common session)

### Testing
- Happy path: approved content → publish → status updated → event emitted
- Error path: content not approved → 409
- Partial failure: one platform fails, others succeed
- Safety rejection: blocked content → 422

---

## 6. ORION-94: Dashboard Publish UI

### Problem
Dashboard has no way to trigger or view publishing. Need a "Publish" button on approved content and a publishing history view.

### Design

**Content detail page changes** (`/queue/[id]`):
- Add "Publish" button (visible only when status === `approved`)
- Button opens a modal: select platforms (checkboxes), confirm
- On confirm: `POST /api/v1/publisher/publish`
- Show success/error toast
- Real-time status update via WebSocket when `CONTENT_PUBLISHED` event arrives

**New page: `/publishing`:**
- Table showing publish history (content title, platform, status, published_at, post link)
- Filter by platform, status
- Fetches from `GET /api/v1/publisher/publish/history`

**Sidebar update:**
- Add "Publishing" nav item with `Send` icon from lucide-react

**Components:**
- `dashboard/src/components/publish-modal.tsx` — platform selection + confirm
- `dashboard/src/app/(dashboard)/publishing/page.tsx` — history page

### Changes
- Create `dashboard/src/components/publish-modal.tsx`
- Create `dashboard/src/app/(dashboard)/publishing/page.tsx`
- Modify `dashboard/src/app/(dashboard)/queue/[id]/page.tsx` — add Publish button
- Modify `dashboard/src/components/sidebar.tsx` — add Publishing nav
- Modify `dashboard/src/types/api.ts` — add PublishRecord type

### Testing
- Component renders publish button only for approved content
- Modal shows available platforms
- History page loads and displays records

---

## 7. ORION-95: Content Safety Pre-Publish Stub

### Problem
Need a safety gate before content reaches social platforms. Full ML-based safety is future work; this sprint implements a rule-based stub.

### Design

**Rule-based checks:**
1. **Keyword blocklist**: reject if content contains blocked words (configurable list)
2. **Minimum length**: content body must be > 10 characters
3. **Media presence**: warn if publishing video content without media assets
4. **Platform limits**: reject if text exceeds platform character limit

**Interface:**
```python
class SafetyCheckResult:
    passed: bool
    violations: list[str]  # human-readable reasons

async def check_content_safety(
    content: Content,
    media_assets: list[MediaAsset],
    platform: str,
) -> SafetyCheckResult:
    ...
```

**Blocklist**: loaded from `ORION_CONTENT_BLOCKLIST` env var (comma-separated) or default empty list.

### Changes
- Create `services/publisher/src/services/safety.py`
- Called by publishing workflow before provider.publish()

### Testing
- Pass: clean content with media
- Fail: content with blocked word
- Fail: empty content body
- Fail: text exceeds platform limit

---

## Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Foundation-first sprint scope (auth + WS + publishing start) | Publishing-only, Dashboard-only | Auth is prerequisite for secure publishing; closes ORION-7 |
| 2 | JWT on Gateway (Go) | Auth on each Python service, external auth (Keycloak) | Single entry point; Gateway is the security boundary; YAGNI |
| 3 | Single-user env var credentials | Database user table, OAuth provider | Single operator system; no multi-tenant needed |
| 4 | HS256 JWT signing | RS256, ES256 | Simpler for single-service signing; no key distribution needed |
| 5 | WebSocket on Gateway with Redis bridge | SSE, polling, WebSocket on each service | Gateway is single entry; Redis pub/sub already connects all services |
| 6 | Query param JWT for WebSocket | Cookie auth, protocol header | Browser WebSocket API cannot set custom headers |
| 7 | X/Twitter first platform | YouTube, TikTok, Instagram | Simplest API (text+media), free tier, well-documented |
| 8 | New Publisher service | Extend Editor or Director | Separation of concerns; Editor renders, Publisher distributes |
| 9 | tweepy for X API | httpx direct, twitter-api-v2 | Mature library, handles media upload chunking, good async support |
| 10 | Fernet encryption for credentials | AES-GCM, Vault, env vars only | Simple, built into cryptography package; symmetric key from env |
| 11 | Rule-based safety stub | ML-based, external API (OpenAI moderation) | YAGNI; ML is future work; stub establishes the interface |

## Assumptions

1. **Single-user system** — one admin operator, no multi-tenant auth
2. **X API v2 free tier** — supports posting tweets with media (may have rate limits)
3. **tweepy 4.14+** — has async support and X API v2 compatibility
4. **gorilla/websocket** — mature, widely used Go WebSocket library
5. **24h JWT expiry** — reasonable for single-user; dashboard handles refresh
6. **Manual publishing** — operator explicitly publishes, no auto-scheduling this sprint
7. **Content safety is a stub** — rule-based only; ML-based safety is a future sprint

## Non-Functional Requirements

| Requirement | Target | Source |
|-------------|--------|--------|
| JWT validation latency | < 1ms (in-memory, no DB lookup) | Single-user, HS256 |
| WebSocket connections | 1-5 concurrent | Single operator |
| Publish latency | < 10s per platform | X API typical response time |
| Credential encryption | AES-128 (Fernet) | Industry standard |
| Auth token expiry | 24 hours | Balance security/UX |
| WebSocket keepalive | 30s ping interval | Prevent proxy timeouts |
