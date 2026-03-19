# Auth Current State: Orion Authentication, User Management, and Data Isolation

**Generated:** 2026-03-19
**Scope:** Research-only analysis of the codebase at `/home/gishantsingh/Dev/Projects/orion`

---

## Executive Summary

Orion operates as a single-tenant, single-administrator system. There is exactly one user account — a hardcoded admin — defined entirely through environment variables. No user database table exists. All content, trends, analytics, and publishing records are global with no concept of per-user ownership. There is no OAuth integration, no user registration flow, and no user profile storage. The authentication system is functional and production-hardened at the gateway level (JWT with Redis blacklist), but it is fundamentally a single-user admin tool rather than a multi-user application.

---

## 1. Gateway Authentication System

### 1.1 How Login Works

**Entry point:** `POST /api/v1/auth/login`
**Handler:** `/home/gishantsingh/Dev/Projects/orion/internal/gateway/handlers/auth.go:80`

The login flow is entirely in-process with no database lookup:

1. The `AuthHandler` is constructed at startup in `NewAuthHandler()` (line 51), which immediately bcrypt-hashes the admin password from config. The hash is stored in memory as `adminPasswordHash`.
2. On `POST /api/v1/auth/login`, the handler compares `req.Username` to `cfg.AdminUsername` (string equality, line 95).
3. It then calls `bcrypt.CompareHashAndPassword(h.adminPasswordHash, []byte(req.Password))` (line 101).
4. On success, `generateToken()` (line 63) creates a `jwt.MapClaims` with these fields:
   - `jti`: new UUID (used for blacklisting)
   - `sub`: admin username
   - `username`: admin username
   - `email`: admin email
   - `role`: hardcoded string `"admin"`
   - `iat` / `exp`: issued-at and expiry (2 hours)
5. The response includes a hardcoded user object: `ID: "admin-001"` (line 119) — this ID is a static string literal, not a database-generated value.

**Rate limiting:** Auth endpoints are protected with a Redis-backed rate limiter: 5 requests per minute per IP (`router.go:85-93`).

### 1.2 JWT Token Structure

Tokens are signed with HS256. The JWT claims are:

| Claim | Value |
|---|---|
| `jti` | Random UUID (for blacklisting) |
| `sub` | Admin username from env |
| `username` | Admin username from env |
| `email` | Admin email from env |
| `role` | Static string `"admin"` |
| `iat` | Unix timestamp of issue |
| `exp` | Unix timestamp of issue + 7200 seconds |

There is no numeric user ID claim, no per-user permissions claim, and no tenant claim.

### 1.3 JWT Middleware (Gateway)

**File:** `/home/gishantsingh/Dev/Projects/orion/internal/gateway/middleware/auth.go`

The `Auth(secret, blacklist)` middleware:
1. Extracts the `Authorization: Bearer <token>` header.
2. Parses and verifies the HMAC-SHA256 signature.
3. If a blacklist is configured, checks the JTI against Redis (`orion:token:blacklist:<jti>` key).
4. Extracts `username`, `email`, `role` into a `UserClaims` struct stored in `context.Context` via key `"user"`.
5. The user claims are accessible downstream via `middleware.GetUser(ctx)` — but importantly, **the gateway proxy does not forward these claims to Python services** (no `X-User-*` header injection in `proxy.go`).

The middleware is applied to all routes under `/api/v1/*`, `/status`, `/metrics`, `/api/v1/auth/logout`, and `/api/v1/ws/ticket`.

### 1.4 Token Blacklist

**File:** `/home/gishantsingh/Dev/Projects/orion/pkg/auth/blacklist.go`

- Backed by Redis with key pattern `orion:token:blacklist:<jti>`.
- Entries expire at the token's natural expiry time (TTL is set to the remaining validity of the original token).
- Fail-closed: if Redis is unreachable, `IsRevoked()` returns `true`.
- Used during logout (adds current JTI to blacklist) and refresh (revokes old token before issuing new one).

### 1.5 Token Refresh

**Endpoint:** `POST /api/v1/auth/refresh`
**Handler:** `auth.go:134`

- Accepts the current valid bearer token.
- Checks it is not already revoked.
- Revokes the old JTI.
- Issues a fresh token with new JTI and new 2-hour expiry.
- Response always returns `ID: "admin-001"`.

### 1.6 WebSocket Authentication (Ticket-based)

**Endpoint:** `POST /api/v1/ws/ticket` (protected), `GET /ws` (ticket-validated)

The WebSocket upgrade path uses a short-lived ticket mechanism to avoid sending JWTs over query strings:
1. Client calls `POST /api/v1/ws/ticket` with a valid bearer token to get a one-time ticket UUID (30-second TTL stored in Redis under `ws:ticket:<uuid>`).
2. Client opens `GET /ws?ticket=<uuid>`.
3. The WebSocket handler redeems the ticket from Redis (deletes the key atomically to enforce single-use).

### 1.7 User Model in Go

There is no Go struct representing a persistent user entity. The only Go user model is the ephemeral `authUser` response struct in `auth.go:31-36`:

```go
type authUser struct {
    ID       string  // always "admin-001"
    Username string
    Email    string
    Role     string
}
```

And the context-scoped `UserClaims` middleware struct in `middleware/auth.go:15-19`:

```go
type UserClaims struct {
    Username string
    Email    string
    Role     string
}
```

Neither is persisted anywhere.

### 1.8 Configuration

**File:** `/home/gishantsingh/Dev/Projects/orion/pkg/config/config.go`

All user credentials live in environment variables:

| Env Var | Default | Purpose |
|---|---|---|
| `ORION_JWT_SECRET` | `dev-secret-change-in-production` | JWT signing key |
| `ORION_ADMIN_USER` | `admin` | The one username |
| `ORION_ADMIN_PASS` | `orion_dev` | The one password |
| `ORION_ADMIN_EMAIL` | `admin@orion.local` | Used in JWT claims |
| `ORION_INTERNAL_TOKEN` | `""` (disabled) | Internal service auth token |

`InsecureDefaults()` and `EnforceProduction()` will flag and block startup if the default JWT secret or admin password remain in production.

---

## 2. Dashboard Authentication

### 2.1 Session Storage

**File:** `/home/gishantsingh/Dev/Projects/orion/dashboard/src/lib/auth.ts`

The dashboard stores three cookies after successful login:

| Cookie Name | `httpOnly` | Content |
|---|---|---|
| `orion_token` | `true` | The raw JWT string |
| `orion_token_expiry` | `true` | ISO timestamp of expiry |
| `orion_user` | `false` | JSON-serialized `User` object (accessible from browser JS) |

The `orion_token` and `orion_token_expiry` cookies are `httpOnly: true`, making them inaccessible to JavaScript. The `orion_user` cookie is `httpOnly: false` — deliberately readable by client code for displaying user information without exposing the token itself.

All cookies use `sameSite: "lax"` and `secure: true` in production.

### 2.2 Middleware Route Protection

**File:** `/home/gishantsingh/Dev/Projects/orion/dashboard/src/middleware.ts`

The Next.js middleware runs on every request and enforces authentication:

1. **Demo mode bypass:** If `NEXT_PUBLIC_DEMO_MODE=true`, authentication is bypassed entirely. `/login` redirects to `/`.
2. **Public paths:** Only `/login` is public. An authenticated user visiting `/login` is redirected to `/`.
3. **Static files/Next.js internals:** `/_next/*`, `/api/*`, and paths with file extensions pass through.
4. **Auth gate:** Any other route requires `orion_token` cookie. If absent, redirects to `/login?redirect=<path>`.
5. **Expiry check:** If `orion_token_expiry` is in the past, cookies are cleared and the user is redirected to `/login`.

Note: The middleware checks token expiry by comparing the `orion_token_expiry` cookie timestamp to `new Date()`. It does **not** cryptographically validate the JWT — that happens only at the gateway when API calls are made.

### 2.3 Token Usage in API Calls

**File:** `/home/gishantsingh/Dev/Projects/orion/dashboard/src/lib/actions.ts`

Server Actions use `getAuthToken()` from `auth.ts` to read the `orion_token` cookie and inject it as `Authorization: Bearer <token>` in all calls to the gateway. The `GATEWAY_INTERNAL_URL` env var is used server-side (allows different internal Docker hostname vs. public hostname).

### 2.4 Token Refresh in Dashboard

The `refreshTokenIfNeeded()` function in `auth.ts:91` proactively refreshes the token when it has less than 5 minutes remaining. This function is not wired into a scheduled call or interceptor — it must be explicitly called by components or actions that need it.

### 2.5 Logout

`logout()` in `auth.ts:61` deletes all three cookies and redirects to `/login`. It does **not** call `POST /api/v1/auth/logout` on the gateway, meaning the old JWT remains valid at the gateway level until its natural expiry. The gateway's blacklist is only populated by calling the logout endpoint explicitly.

### 2.6 User Profile Page

There is no user profile page in the dashboard. The `TopNav` component (`/home/gishantsingh/Dev/Projects/orion/dashboard/src/components/top-nav.tsx`) renders a `CircleUser` icon as a static button with no routing, no user name display, and no dropdown.

---

## 3. Database Schema (Complete)

### 3.1 Migration Chain

Managed with Alembic. All migrations are at the repo root under `/home/gishantsingh/Dev/Projects/orion/migrations/versions/`. The `env.py` uses the shared `orion_common.db.models.Base` metadata for autogenerate.

| Migration | Description |
|---|---|
| `001_initial_schema.py` | `trends`, `contents`, `media_assets`, `providers`, `pipeline_runs` |
| `002_add_publisher_tables.py` | `social_accounts`, `publish_records` |
| `003_add_indexes.py` | Indexes on `contents.created_at`, `trends.topic` |
| `004_add_performance_indexes.py` | Additional indexes on `contents`, `pipeline_runs` |

### 3.2 Tables and Columns

**`trends`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `topic` | String(512) | |
| `source` | String(256) | |
| `score` | Float | |
| `raw_data` | JSON | |
| `detected_at` | DateTime(tz) | |
| `expired_at` | DateTime(tz) | |
| `status` | Enum(active/expired/archived) | |

No `user_id`. All trends are global.

**`contents`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `trend_id` | UUID FK -> trends.id | |
| `title` | String(512) | |
| `script_body` | Text | |
| `hook` | String(1024) | |
| `visual_prompts` | JSON | |
| `status` | Enum(draft/generating/review/approved/published/rejected) | |
| `created_at` | DateTime(tz) | |
| `updated_at` | DateTime(tz) | |

No `user_id`, no `created_by`. All content is global.

**`media_assets`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `content_id` | UUID FK -> contents.id | |
| `asset_type` | Enum(image/video/audio) | |
| `provider` | String(256) | |
| `file_path` | String(1024) | |
| `metadata` | JSON | |
| `created_at` | DateTime(tz) | |

**`providers`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | String(256) unique | |
| `provider_type` | String(128) | |
| `config` | JSON | |
| `is_active` | Boolean | |
| `priority` | Integer | |

**`pipeline_runs`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `content_id` | UUID FK -> contents.id | |
| `stage` | String(128) | |
| `status` | Enum(pending/running/completed/failed) | |
| `started_at` | DateTime(tz) | |
| `completed_at` | DateTime(tz) | |
| `error_message` | Text | |

**`social_accounts`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `platform` | String(128) | |
| `display_name` | String(256) | |
| `credentials` | Text | Fernet-encrypted JSON |
| `is_active` | Boolean | |
| `created_at` | DateTime(tz) | |

No `user_id`. Social accounts are global.

**`publish_records`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `content_id` | UUID FK -> contents.id | |
| `social_account_id` | UUID FK -> social_accounts.id (nullable) | |
| `platform` | String(128) | |
| `platform_post_id` | String(512) | |
| `status` | Enum(published/failed) | |
| `error_message` | Text | |
| `published_at` | DateTime(tz) | |
| `created_at` | DateTime(tz) | |

**`analytics_events`** (defined in Pulse's `event_repo.py`, not in a migration)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `channel` | String(256) | |
| `payload` | JSON | |
| `service` | String(128) | |
| `timestamp` | DateTime(tz) | |

This table is defined as an ORM model in `services/pulse/src/repositories/event_repo.py` but has no corresponding Alembic migration in `migrations/versions/`. The table only exists if `Base.metadata.create_all()` is called, or if a migration is added in the future.

### 3.3 Entity-Relationship Summary

```
trends (1) ──< contents (1) ──< media_assets
                            ──< pipeline_runs
                            ──< publish_records >── social_accounts
```

No users table. No foreign keys to any user entity anywhere in the schema.

---

## 4. Multi-Tenancy and Data Isolation

### 4.1 Current State: Global, Single-Tenant

All data is global. There is no concept of ownership:

- The queue page (`/queue`) fetches all content with no user filter: `GET /api/v1/content?status=...`
- Trend detection by Scout writes trends globally; Director picks them up globally.
- Publishing records are global; the publishing page shows all platform publish attempts.
- Analytics events in Pulse are global; no per-user breakdown is possible.

### 4.2 Gateway Does Not Forward User Identity to Services

The gateway's proxy handler (`proxy.go:17-65`) injects only two headers into upstream requests:
- `X-Request-ID` (from middleware context)
- `X-Internal-Token` (if configured)

The authenticated `UserClaims` extracted by the JWT middleware are stored in Go's `context.Context` but are **never forwarded** to Python services. Python services have no way to know which user initiated a request.

### 4.3 Python Services Trust the Internal Token, Not the JWT

Each Python service wraps itself in `InternalAuthMiddleware` (`libs/orion-common/orion_common/middleware.py`). This middleware:
- If `ORION_INTERNAL_TOKEN` is empty (default in dev), allows all requests through.
- If set, validates the `X-Internal-Token` header.
- Does **not** validate JWTs at the service level.

This design correctly places JWT validation at the gateway boundary and uses a simpler shared-secret mechanism for internal communication. However, it means Python services cannot enforce per-user data access — they have no authenticated user identity available.

---

## 5. OAuth and External Identity Providers

There is no OAuth integration anywhere in the codebase:
- No OAuth callback routes in the gateway router.
- No OAuth client libraries in any `pyproject.toml` or `go.mod`.
- No `/api/v1/auth/callback`, `/oauth/authorize`, or similar routes.
- No state parameters, PKCE, or authorization code flow logic.
- The dashboard login form is a simple username/password form only.

---

## 6. Social Account Credentials Storage

Social media credentials (Twitter/X API keys, etc.) are stored encrypted in the `social_accounts.credentials` column using Fernet symmetric encryption.

**File:** `/home/gishantsingh/Dev/Projects/orion/services/publisher/src/services/crypto.py`

- Key source: `ORION_ENCRYPTION_KEY` environment variable (required; startup fails without it).
- Algorithm: Fernet (AES-128-CBC + HMAC-SHA256).
- The credentials dict is JSON-serialized, then encrypted, then stored as a text string.
- On retrieval, it is decrypted before being passed to platform provider clients.
- The `SocialAccountResponse` schema redacts credentials — they are never returned in API responses.

---

## 7. Auth-Related Files Reference

| File | Layer | Purpose |
|---|---|---|
| `/home/gishantsingh/Dev/Projects/orion/internal/gateway/handlers/auth.go` | Gateway | Login, logout, refresh, WebSocket ticket endpoints |
| `/home/gishantsingh/Dev/Projects/orion/internal/gateway/middleware/auth.go` | Gateway | JWT validation middleware; user context injection |
| `/home/gishantsingh/Dev/Projects/orion/pkg/auth/token.go` | Shared Go pkg | `ValidateToken()` helper |
| `/home/gishantsingh/Dev/Projects/orion/pkg/auth/blacklist.go` | Shared Go pkg | Redis-backed JWT revocation blacklist |
| `/home/gishantsingh/Dev/Projects/orion/pkg/config/config.go` | Shared Go pkg | Admin credentials and JWT secret from env |
| `/home/gishantsingh/Dev/Projects/orion/internal/gateway/router/router.go` | Gateway | Route mounting; which routes are auth-protected |
| `/home/gishantsingh/Dev/Projects/orion/internal/gateway/handlers/proxy.go` | Gateway | Reverse proxy; header forwarding (notably: no user header) |
| `/home/gishantsingh/Dev/Projects/orion/libs/orion-common/orion_common/middleware.py` | Shared Python lib | `InternalAuthMiddleware`; service-level token validation |
| `/home/gishantsingh/Dev/Projects/orion/libs/orion-common/orion_common/config.py` | Shared Python lib | `ORION_INTERNAL_TOKEN` config |
| `/home/gishantsingh/Dev/Projects/orion/dashboard/src/lib/auth.ts` | Dashboard | Login/logout/session/refresh Server Actions; cookie management |
| `/home/gishantsingh/Dev/Projects/orion/dashboard/src/middleware.ts` | Dashboard | Route protection; token expiry checks |
| `/home/gishantsingh/Dev/Projects/orion/dashboard/src/app/(auth)/login/login-form.tsx` | Dashboard | Login UI form |
| `/home/gishantsingh/Dev/Projects/orion/dashboard/src/types/api.ts` | Dashboard | `User`, `AuthResponse` TypeScript interfaces |
| `/home/gishantsingh/Dev/Projects/orion/services/publisher/src/services/crypto.py` | Publisher service | Fernet encryption for social account credentials |
| `/home/gishantsingh/Dev/Projects/orion/libs/orion-common/orion_common/db/models.py` | Shared Python lib | All SQLAlchemy ORM models — no users table |
| `/home/gishantsingh/Dev/Projects/orion/migrations/versions/001_initial_schema.py` | DB | Initial schema migration — no users table |
| `/home/gishantsingh/Dev/Projects/orion/migrations/versions/002_add_publisher_tables.py` | DB | Publisher tables migration |

---

## 8. Data Flow Diagrams

### 8.1 Login Flow

```
Browser
  |
  | POST /login (form submit)
  v
Next.js Server Action (login() in auth.ts)
  |
  | POST /api/v1/auth/login  {username, password}
  v
Gateway (Go, :8000)
  |
  | - Rate limit check (5 req/min/IP via Redis)
  | - Username string compare vs ORION_ADMIN_USER
  | - bcrypt.CompareHashAndPassword vs pre-hashed ORION_ADMIN_PASS
  | - jwt.NewWithClaims(HS256, {jti, sub, username, email, role:"admin", iat, exp})
  | - token.SignedString(ORION_JWT_SECRET)
  |
  | 200 {access_token, token_type, expires_in, user:{id:"admin-001",...}}
  v
Server Action
  | - Sets orion_token cookie (httpOnly)
  | - Sets orion_token_expiry cookie (httpOnly)
  | - Sets orion_user cookie (readable by JS)
  v
Browser redirected to /
```

### 8.2 Authenticated API Request Flow

```
Browser
  |
  | (Dashboard Server Component or Server Action)
  v
Next.js Server
  | - Reads orion_token from cookies()
  | - Makes fetch() with Authorization: Bearer <token>
  v
Gateway (Go, :8000)  [middleware chain]
  | 1. RequestID middleware
  | 2. Logger
  | 3. Recoverer
  | 4. SecurityHeaders
  | 5. CORS
  | 6. Metrics
  | 7. MaxBodySize
  | 8. Auth middleware:
  |      - Parse JWT, verify HS256 sig
  |      - Check JTI not in Redis blacklist
  |      - Store UserClaims in context
  | 9. RateLimit middleware (per service)
  |10. Proxy handler:
  |      - Strip /api/v1/{service} prefix
  |      - Add X-Request-ID header
  |      - Add X-Internal-Token header (if configured)
  |      [UserClaims NOT forwarded]
  v
Python Service (FastAPI, :8001-8006)
  | InternalAuthMiddleware:
  |   - If ORION_INTERNAL_TOKEN set: validate X-Internal-Token header
  |   - No JWT validation; no user identity available
  v
Repository -> SQLAlchemy -> PostgreSQL
  (global data, no user filter)
```

### 8.3 Logout Flow

```
Dashboard (logout() Server Action)
  |
  | - Deletes orion_token, orion_token_expiry, orion_user cookies
  | - Does NOT call gateway /api/v1/auth/logout
  |
  v
User is redirected to /login
  (Old JWT remains valid at gateway until natural expiry)
```

---

## 9. Identified Gaps

### 9.1 No Users Table or User Registry

There is no `users` table in the database. User identity exists only in environment variables and JWT claims. There is no user registration, invitation, or self-service account creation. The admin user ID is a hardcoded string literal `"admin-001"` returned in the login response.

**Impact:** Implementing multi-user support requires creating a users table, migrating auth to query it, and updating all JWT generation to use database-sourced user IDs.

### 9.2 No Per-User Data Isolation

Zero foreign keys to any user entity exist in any table. All content, trends, media assets, analytics, and publishing records are global. Any authenticated session sees and can act on all system data.

**Impact:** Implementing row-level security or per-user data requires adding `user_id` foreign keys to at minimum the `contents`, `trends`, and `social_accounts` tables, writing a migration, updating all repository queries to filter by user, and updating all API endpoints to pass authenticated user context.

### 9.3 User Identity Not Propagated to Python Services

The gateway JWT middleware extracts `UserClaims` into Go context but the proxy handler does not inject any `X-User-*` headers. Python services receive no user identity.

**Impact:** Even if a `user_id` column existed in the database, Python service repositories could not filter by it — they have no access to the current user's identity.

### 9.4 Dashboard Logout Does Not Revoke Token at Gateway

The `logout()` Server Action in `auth.ts` only clears cookies. It does not call `POST /api/v1/auth/logout`. The token remains valid at the gateway until its 2-hour expiry unless the logout endpoint is also called.

**Impact:** If a token is stolen or a session cookie is exfiltrated, clearing cookies alone does not invalidate the JWT. The gateway's blacklist mechanism exists but is not wired to the dashboard's logout flow.

### 9.5 No OAuth Integration

There are no OAuth 2.0 flows, social login providers, or OIDC integration. The only authentication mechanism is username/password against the single hardcoded admin account.

### 9.6 No User Profile or Settings Storage

There is no user profile page, no user preferences storage, no per-user notification settings, and no user-scoped configuration. The `CircleUser` icon in `TopNav` is a non-functional placeholder.

### 9.7 The `analytics_events` Table Has No Migration

The `AnalyticsEvent` ORM model defined in `services/pulse/src/repositories/event_repo.py` is not covered by any Alembic migration in `migrations/versions/`. The table only exists if created out-of-band (e.g., via `create_all()`). This is a schema management gap independent of auth but worth noting.

### 9.8 Demo Mode Bypasses All Auth

The `NEXT_PUBLIC_DEMO_MODE=true` environment variable completely bypasses the Next.js middleware auth checks. In demo mode, anyone can access the dashboard without credentials. This is intentional for demonstration but must not be enabled in any production deployment.

---

## 10. What Is Working Well

- The JWT implementation is correct: HS256 signing, `jti` for blacklisting, 2-hour expiry, rate-limited auth endpoints.
- The Redis-backed token blacklist correctly supports logout and token rotation via refresh.
- `httpOnly` cookie for token storage is correct security practice — the token is not accessible to browser JavaScript.
- Production security is enforced at startup: `EnforceProduction()` rejects insecure default secrets.
- Social media credentials are encrypted at rest with Fernet (AES-128-CBC + HMAC-SHA256) — correctly not stored in plaintext.
- The `InternalAuthMiddleware` provides a correct architectural boundary between the public-facing JWT auth layer (gateway) and the internal service network (shared token).
- The WebSocket ticket mechanism correctly avoids putting JWTs in URL query strings.

---

## Essential Files for Understanding This Topic

1. `/home/gishantsingh/Dev/Projects/orion/internal/gateway/handlers/auth.go` — complete auth endpoint logic
2. `/home/gishantsingh/Dev/Projects/orion/internal/gateway/middleware/auth.go` — JWT middleware
3. `/home/gishantsingh/Dev/Projects/orion/pkg/auth/blacklist.go` — token revocation
4. `/home/gishantsingh/Dev/Projects/orion/pkg/config/config.go` — single-user credential config
5. `/home/gishantsingh/Dev/Projects/orion/internal/gateway/router/router.go` — which routes are protected
6. `/home/gishantsingh/Dev/Projects/orion/internal/gateway/handlers/proxy.go` — user context not forwarded to services
7. `/home/gishantsingh/Dev/Projects/orion/libs/orion-common/orion_common/middleware.py` — Python-side internal auth
8. `/home/gishantsingh/Dev/Projects/orion/libs/orion-common/orion_common/db/models.py` — all database models (no users table)
9. `/home/gishantsingh/Dev/Projects/orion/migrations/versions/001_initial_schema.py` — database schema source of truth
10. `/home/gishantsingh/Dev/Projects/orion/migrations/versions/002_add_publisher_tables.py` — publisher tables
11. `/home/gishantsingh/Dev/Projects/orion/dashboard/src/lib/auth.ts` — dashboard session management
12. `/home/gishantsingh/Dev/Projects/orion/dashboard/src/middleware.ts` — dashboard route protection
13. `/home/gishantsingh/Dev/Projects/orion/services/publisher/src/services/crypto.py` — credential encryption
14. `/home/gishantsingh/Dev/Projects/orion/dashboard/src/types/api.ts` — User and AuthResponse TypeScript types
