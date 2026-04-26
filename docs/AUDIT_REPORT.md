# Documentation Audit Report

**Generated:** 2026-03-20
**Scope:** All documentation under `docs/`, `README.md`, `CLAUDE.md`, and service-level docs
**Auditor:** Claude Code Agent

---

## 1. Executive Summary

The Orion documentation is extensive and well-structured, covering architecture, API endpoints, deployment, monitoring, and guides. However, the audit reveals **significant version inconsistencies** across files, **stale references** to a pre-auth-migration architecture in several places, **missing endpoint routes** documented but not implemented, and a **port conflict** between the dashboard and Grafana. The most critical issues are version contradictions in `docs/TECH_STACK.md` and the `auth-current-state.md` document being severely outdated relative to the current codebase.

**Summary of findings:**
- **Critical:** 7 issues (version conflicts, stale architecture docs, missing routes)
- **High:** 9 issues (inconsistencies between docs, incorrect defaults, missing Identity service)
- **Medium:** 12 issues (outdated commands, minor inaccuracies, missing docs)
- **Low:** 8 issues (style, structure, minor omissions)

---

## 2. File-by-File Findings

### 2.1 `docs/TECH_STACK.md`

**Severity: CRITICAL** -- This file contradicts nearly every other doc and the actual codebase.

| Field | TECH_STACK.md says | Actual (go.mod/pyproject.toml) | Other docs say |
|-------|-------------------|-------------------------------|----------------|
| Go version | **1.26** | `go 1.25` (go.mod line 3) | 1.24 (README, CLAUDE.md, all other docs) |
| Python services | **3.14** | `>=3.13` (scout pyproject.toml) | 3.13 (README, CLAUDE.md, all other docs) |
| Node.js | **25** | Not pinned in package.json | 22 LTS (README, getting-started) |
| Gateway framework | **net/http** (stdlib) | Chi 5.x (imports in router.go) | Chi 5.x (README, CLAUDE.md) |
| Dashboard TypeScript | **5.x** | Correct | -- |

**Recommendation:** Rewrite `docs/TECH_STACK.md` to match actual dependency versions. The Go version should be `1.25` (per go.mod), Python services `3.13` (per pyproject.toml), Node.js `22 LTS`, and gateway framework should say `Chi 5.x` (not `net/http`).

### 2.2 `README.md`

| Line | Issue | Severity |
|------|-------|----------|
| 3 | References `docs/assets/orion-logo.svg` -- file does not exist | Medium |
| 22 | Describes dashboard as "dark-themed" -- the dashboard now has both light and dark themes with glassmorphism design per recent commits | Medium |
| 87 | Architecture diagram shows Dashboard on `:3000` -- correct for production but memory note says dev=3001 | Low |
| 155 | Monorepo structure omits `services/identity/` entirely | High |
| 249 | Dashboard port listed as `3000` -- correct for production, but should note dev port `3001` | Low |
| 294 | Describes "Orion Nebula" as "dark theme" -- now glass liquid design in both light and dark themes | Medium |
| 319-320 | Git clone URL is `github.com/orion-rigel/orion.git` which matches go.mod, but `docs/getting-started/installation.md` line 8 uses `github.com/orion-platform/orion.git` | High |
| 392 | `make py-format` described as "Black formatting" -- project uses `ruff format`, not Black | Medium |
| 581 | Tech stack table says Go 1.24 -- go.mod says 1.25 | Critical |

### 2.3 `CLAUDE.md`

| Line | Issue | Severity |
|------|-------|----------|
| 11 | States "Go 1.24" -- go.mod says `go 1.25` | Critical |
| 24 | States `Dashboard (Next.js, :3000)` -- production is 3000, dev is 3001 per memory | Low |
| 21 | States services range `:8001-8007` -- correct, Identity is :8007 | OK |

### 2.4 `docs/index.md`

| Line | Issue | Severity |
|------|-------|----------|
| 63 | Dashboard shown on `:3000` -- should clarify production vs dev port | Low |
| 163 | Publisher mentions "Instagram" -- the `README.md` services table says "LinkedIn", and `docs/services/publisher.md` says "Instagram". No LinkedIn or Instagram provider code exists in `services/publisher/` | High |
| 279 | `cd services/scout && pytest` -- should be `cd services/scout && uv run pytest` per project conventions | Medium |

### 2.5 `docs/architecture/auth-current-state.md`

**Severity: CRITICAL** -- This entire document is outdated. It was generated as a pre-migration analysis on 2026-03-19 and describes the OLD single-admin auth system. The codebase has since been migrated to DB-backed multi-user auth with:

- OAuth routes now exist in `router.go` (lines 95-107)
- User header forwarding (`X-User-ID`, `X-User-Role`, `X-User-Email`) now exists in `proxy.go` (lines 36-40)
- `UserClaims` struct now includes `UserID` field (middleware/auth.go line 16)
- Identity service exists at `services/identity/`
- Migrations 005-008 have been applied

Key false claims in this document:
- Section 1.5: "Response always returns `ID: admin-001`" -- no longer true
- Section 4.2: "gateway proxy does not forward these claims to Python services" -- **FALSE**, proxy.go now forwards X-User-ID/Role/Email
- Section 5: "No OAuth integration anywhere in the codebase" -- **FALSE**, OAuth routes exist
- Section 9.3: "User Identity Not Propagated to Python Services" -- **FALSE**, fixed
- The entire document should be either deleted or marked as historical/superseded

### 2.6 `docs/architecture/db-schema-design.md`

| Line | Issue | Severity |
|------|-------|----------|
| 1-17 | Status says "Proposed" -- this has been implemented (migrations 005-008 exist) | Medium |
| 210-226 | `user_settings` schema shows separate JSONB columns (`provider_preferences`, `pipeline_config`, etc.) but `docs/architecture/database.md` line 204 shows a single `settings` JSON column | High |
| 287-292 | Shows `contents` getting a `user_id` column, but actual code uses `created_by` (models.py line 266) | High |
| 713-792 | Migration plan describes migrations 005-009, but actual files are 005-008 with different names (`005_add_user_tables.py`, `006_add_user_id_to_content_tables.py`, `007_enforce_user_id_not_null.py`, `008_add_user_name_fields.py`) | Medium |

### 2.7 `docs/architecture/database.md`

| Line | Issue | Severity |
|------|-------|----------|
| 12 | States "11 tables" -- should verify against actual migration output | Low |
| 89-90 | `contents` table shows `created_by UUID FK users.id` -- this matches the actual code (unlike the design doc which uses `user_id`) | OK |
| 416-423 | Migration history lists 7 migrations (001-007) but there are actually 8 migrations (001-008). Migration 008 (`008_add_user_name_fields.py`) is missing from the docs | Medium |
| 420 | Migration 005 described as "Add user management tables" with filename implied as `005_add_user_tables.py` -- actual filename is `005_add_user_tables.py` | OK |

### 2.8 `docs/architecture/port-map.md`

| Line | Issue | Severity |
|------|-------|----------|
| 20 | Dashboard on port `3000`, Grafana on port `3001` -- this creates a conflict with the memory note "Production=3000, Dev=3001" for the dashboard. The port map should clarify that dashboard dev mode (3001) conflicts with Grafana | High |
| 46 | Grafana on `3001` -- this is correct for monitoring stack but conflicts with dashboard dev port | High |

### 2.9 `docs/architecture/security.md`

| Line | Issue | Severity |
|------|-------|----------|
| 87 | User roles listed as `admin`, `user` -- actual enum in models.py is `admin`, `editor`, `viewer` | High |
| 117-135 | Lists `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/verify-email` as public endpoints -- **these routes do NOT exist in router.go** | Critical |
| 156 | Middleware chain order lists Auth before RateLimit -- in router.go, rate limiting is applied differently per route group, not as a global middleware. The description is slightly misleading. Metrics is listed at position 5 but in router.go line 54, `/metrics` is behind Auth middleware | Medium |

### 2.10 `docs/api/index.md`

| Line | Issue | Severity |
|------|-------|----------|
| 22-28 | Service routing table shows gateway prefix → service route prefix mapping -- this is incorrect. The proxy strips `/api/v1/{service}` and forwards the remainder. So `GET /api/v1/scout/api/v1/trends` would hit the Scout service at `/api/v1/trends`. The table is confusing but technically correct if read carefully | Low |

### 2.11 `docs/api/endpoints.md`

| Line | Issue | Severity |
|------|-------|----------|
| 12 | `/metrics` listed as no auth -- in router.go line 54-57, `/metrics` IS behind Auth middleware | High |
| 24-26 | Lists `forgot-password`, `reset-password`, `verify-email` endpoints -- **these are NOT in router.go** | Critical |

### 2.12 `docs/api/authentication.md`

| Line | Issue | Severity |
|------|-------|----------|
| 264 | JWT claims show `role` values as `admin`, `user` -- actual roles are `admin`, `editor`, `viewer` | High |
| 309 | States `ORION_ADMIN_USER` and `ORION_ADMIN_PASS` are deprecated -- this is correct but `EnforceProduction()` in config.go no longer checks for admin password, only checks JWTSecret and PostgresPass | Low |

### 2.13 `docs/api/websocket.md`

| Line | Issue | Severity |
|------|-------|----------|
| 10 | Shows `GET /ws?token=<jwt>` -- but the actual implementation uses a ticket-based mechanism (`POST /api/v1/ws/ticket` to get a ticket, then `GET /ws?ticket=<uuid>`). The JWT-in-query-param approach documented here is the older pattern | High |
| 76 | Timestamp in example is `2024-03-12` -- should be updated to 2026 | Low |

### 2.14 `docs/deployment/docker.md`

| Line | Issue | Severity |
|------|-------|----------|
| 66 | PostgreSQL image listed as `postgres:16-alpine` -- docker-compose.yml line 291 uses `postgres:17-alpine` | High |
| 129 | Dockerfile example shows `FROM golang:1.24-alpine` -- go.mod says 1.25 | Medium |
| 153 | Python Dockerfile example uses `pip install` -- should use `uv` per project conventions | Medium |

### 2.15 `docs/deployment/production.md`

| Line | Issue | Severity |
|------|-------|----------|
| 8 | References `ORION_ADMIN_PASS` -- deprecated; should reference DB-based user management | Medium |

### 2.16 `docs/getting-started/installation.md`

| Line | Issue | Severity |
|------|-------|----------|
| 8 | Clone URL `github.com/orion-platform/orion.git` -- should be `github.com/orion-rigel/orion.git` (per go.mod) | High |
| 52 | Getting-started fastest path also uses `orion-platform` URL | High |
| 176 | States "six Python services" -- there are now seven (including Identity) | Medium |
| 213 | References `black src/ tests/` for formatting -- project uses `ruff format`, not Black | Medium |

### 2.17 `docs/getting-started/troubleshooting.md`

| Line | Issue | Severity |
|------|-------|----------|
| 57 | Port table omits Identity service (port 8007) | Medium |
| 182 | States "Tokens expire after 24 hours" -- access tokens expire after 15 minutes, refresh tokens after 30 days | High |
| 194 | Refresh example uses `Authorization: Bearer $OLD_TOKEN` -- the current refresh flow uses `{"refresh_token": "ort_..."}` in the request body | Medium |
| 231-233 | References `uv pip install` -- should be `uv sync` for workspace members | Low |
| 265 | References `black src/ tests/` -- should be `ruff format` | Low |

### 2.18 `docs/getting-started/configuration.md`

| Line | Issue | Severity |
|------|-------|----------|
| 35-36 | Configuration table says "six downstream microservices" -- there are seven (Identity missing from the description text, though it IS in the table) | Low |
| -- | `OAUTH_REDIRECT_BASE` default shown as `http://localhost:8000` -- actual default in config.go is `http://localhost:3000` | High |

### 2.19 `docs/services/index.md`

| Line | Issue | Severity |
|------|-------|----------|
| 1-3 | States "ten distinct components" and "seven Python FastAPI microservices (six for the AI content pipeline plus an Identity service)" -- count is correct | OK |
| 154 | Event table shows `orion.video.rendered` as an Editor event -- this channel name does not appear in the communication.md or README event flow diagrams which use different channel names | Medium |
| 156 | States "events are buffered in Redis until consumers are available" -- Redis pub/sub does NOT buffer events. If a subscriber is offline, events are lost. The communication.md correctly notes this (line 89) | High |

### 2.20 `docs/services/gateway.md`

| Line | Issue | Severity |
|------|-------|----------|
| 8 | States Go 1.24 -- go.mod says 1.25 | Medium |
| 32 | WebSocket shows `?token=` query param -- actual implementation uses ticket-based auth | Medium |
| 93 | `OAUTH_REDIRECT_BASE` default shown as `http://localhost:8000` -- actual default is `http://localhost:3000` | Medium |

### 2.21 `docs/services/dashboard.md`

| Line | Issue | Severity |
|------|-------|----------|
| 6 | Port listed as `3000` -- should clarify production (3000) vs dev (3001) | Low |

### 2.22 `docs/services/publisher.md`

| Line | Issue | Severity |
|------|-------|----------|
| 1 | Lists "Instagram" as supported platform -- README services table says "LinkedIn". No code for either exists in `services/publisher/` | Medium |

### 2.23 `docs/development/project-structure.md`

| Line | Issue | Severity |
|------|-------|----------|
| 16 | Lists `handler/` under internal/gateway -- actual directory is `handlers/` (plural) | Low |
| -- | Missing `services/identity/` from the directory tree | Medium |
| 108-120 | Lists test files under `tests/` -- git status shows these files have been deleted | Medium |
| 125-126 | Lists `docker-compose.e2e.yml` -- need to verify this file still exists | Low |

### 2.24 `docs/monitoring/grafana.md`

| Line | Issue | Severity |
|------|-------|----------|
| 7 | Grafana on `:3001` -- conflicts with dashboard dev port | Low (known port map issue) |

### 2.25 Service-Level CLAUDE.md Files

All service CLAUDE.md files are brief and accurate. No major issues found.

---

## 3. Cross-Cutting Issues

### 3.1 Go Version Inconsistency (CRITICAL)

| Source | Go Version |
|--------|-----------|
| `go.mod` (actual) | **1.25** |
| `docs/TECH_STACK.md` | 1.26 |
| `README.md` | 1.24 |
| `CLAUDE.md` | 1.24 |
| `docs/getting-started/index.md` | 1.24 |
| `docs/services/gateway.md` | 1.24 |
| `docs/deployment/docker.md` | 1.24 |

**Resolution:** All references should be updated to `1.25` to match `go.mod`.

### 3.2 `OAUTH_REDIRECT_BASE` Default Inconsistency

| Source | Default |
|--------|---------|
| `pkg/config/config.go` (actual) | `http://localhost:3000` |
| `docs/api/authentication.md` | `http://localhost:8000` |
| `docs/getting-started/configuration.md` | `http://localhost:8000` |
| `docs/services/gateway.md` | `http://localhost:8000` |
| `docs/architecture/security.md` | (not specified) |

**Resolution:** All docs should say `http://localhost:3000` to match the code.

### 3.3 User Roles Inconsistency

| Source | Roles |
|--------|-------|
| `models.py` (actual) | `admin`, `editor`, `viewer` |
| `docs/architecture/security.md` line 87 | `admin`, `user` |
| `docs/api/authentication.md` line 264 | `admin`, `user` |
| `docs/architecture/database.md` line 170 | `admin`, `editor`, `viewer` |

**Resolution:** Replace `user` with the correct enum values (`admin`, `editor`, `viewer`).

### 3.4 Python Formatter Inconsistency

Multiple docs reference `black` as the Python formatter. The project actually uses `ruff format`:

- `README.md` line 392: `make py-format` described as "Black formatting"
- `docs/getting-started/installation.md` line 213: `black src/ tests/`
- `docs/getting-started/troubleshooting.md` line 265: `black src/ tests/`

### 3.5 Git Clone URL Inconsistency

| Source | URL |
|--------|-----|
| `go.mod` (actual) | `github.com/orion-rigel/orion` |
| `README.md` line 319 | `github.com/orion-rigel/orion.git` |
| `docs/getting-started/installation.md` line 8 | `github.com/orion-platform/orion.git` |
| `docs/getting-started/index.md` line 52 | `github.com/orion-platform/orion.git` |

**Resolution:** Use `github.com/orion-rigel/orion.git` consistently.

### 3.6 Publisher Platform Support Inconsistency

| Source | Platforms Listed |
|--------|-----------------|
| `README.md` services table | Twitter, YouTube, TikTok, **LinkedIn** |
| `docs/index.md` | **Instagram** |
| `docs/services/publisher.md` | Twitter, YouTube, TikTok, **Instagram** |
| `docs/data-flow.md` | Twitter, YouTube, TikTok, **Instagram** |
| Actual code | No LinkedIn or Instagram provider implementations found |

### 3.7 Dashboard Port Conflict

The dashboard runs on port 3000 (production) / 3001 (dev). Grafana is also documented on port 3001. This means running the dashboard in dev mode and the monitoring stack simultaneously would cause a port conflict. This should be documented prominently.

### 3.8 Missing Endpoints in Router

The following endpoints are documented in `docs/api/endpoints.md` and `docs/architecture/security.md` but do NOT exist in `internal/gateway/router/router.go`:

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/verify-email`

Either the routes need to be implemented or the docs should mark them as "planned/not yet implemented."

### 3.9 WebSocket Authentication Docs vs Code

Docs (`docs/api/websocket.md`) describe `GET /ws?token=<jwt>` -- the actual implementation uses a two-step ticket-based approach:
1. `POST /api/v1/ws/ticket` (authenticated) returns a short-lived ticket
2. `GET /ws?ticket=<uuid>` uses the ticket to upgrade

The `auth-current-state.md` correctly describes the ticket mechanism (Section 1.6) but the main WebSocket docs do not.

---

## 4. Missing Documentation

### 4.1 Identity Service -- Inadequate Coverage in README

The Identity service (`:8007`) is completely absent from the `README.md` monorepo structure and services table. It should be added alongside the other six Python services.

### 4.2 Missing Onboarding Documentation

Git status shows new onboarding-related files:
- `dashboard/src/app/(onboarding)/`
- `dashboard/src/lib/onboarding-actions.ts`
- `internal/gateway/handlers/auth_onboarding_test.go`
- `internal/gateway/middleware/onboarding_test.go`

No documentation exists for the onboarding flow.

### 4.3 Missing Migration 008 + 009 + 010

The database docs list migrations 001-007. Actual migrations include:
- `008_add_user_name_fields.py`
- `009_update_trend_status_enum.py`
- `010_add_username_to_users.py`

These should be documented in `docs/architecture/database.md`.

### 4.4 No Development Guide for Identity Service

`docs/getting-started/installation.md` mentions "six Python services" and lists them for setup but omits Identity.

### 4.5 No Documentation for `docs/design-brief.md`

This file exists but is not linked from any index or navigation. It should either be linked or noted as internal/historical.

### 4.6 Missing `docs/development/` Pages

Several development guide pages exist but were not audited in detail:
- `docs/development/adding-services.md`
- `docs/development/code-style.md`
- `docs/development/git-workflow.md`
- `docs/development/migrations.md`
- `docs/development/testing.md`

These should be verified for accuracy.

### 4.7 `/metrics` Endpoint Auth

In `router.go` lines 54-57, the `/metrics` endpoint is behind Auth middleware. But `docs/api/endpoints.md` line 12 and `docs/architecture/security.md` line 125 list it as public (no auth required). The docs are wrong.

---

## 5. Prioritized Recommendations

### Priority 1 -- Critical (fix immediately)

1. **Update Go version across all docs** from 1.24 to 1.25 (matching `go.mod`)
2. **Rewrite `docs/TECH_STACK.md`** -- nearly every version is wrong (Go 1.26 should be 1.25, Python 3.14 should be 3.13, Node.js 25 should be 22, gateway framework should be Chi not net/http)
3. **Delete or mark `docs/architecture/auth-current-state.md` as superseded** -- it describes the OLD single-admin system and makes claims that are now false about proxy headers, OAuth, and user propagation
4. **Remove or mark as "not yet implemented"** the `forgot-password`, `reset-password`, and `verify-email` endpoints from endpoint docs and security docs
5. **Fix `/metrics` auth status** in endpoint and security docs -- it requires auth, not public

### Priority 2 -- High (fix soon)

6. **Add Identity service to README.md** -- monorepo structure and services table
7. **Fix `OAUTH_REDIRECT_BASE` default** in all docs from `http://localhost:8000` to `http://localhost:3000`
8. **Fix user role values** in security and auth docs from `admin/user` to `admin/editor/viewer`
9. **Fix PostgreSQL version** in `docs/deployment/docker.md` from `postgres:16-alpine` to `postgres:17-alpine`
10. **Fix git clone URL** in installation docs from `orion-platform` to `orion-rigel`
11. **Fix WebSocket docs** to document the ticket-based auth mechanism instead of raw JWT in query params
12. **Fix `docs/services/index.md`** claim that Redis buffers events -- pub/sub is at-most-once delivery
13. **Document the dashboard port conflict** with Grafana (both can use 3001)
14. **Fix publisher platform list** to be consistent across all docs

### Priority 3 -- Medium (fix when convenient)

15. **Replace Black references with `ruff format`** in README, installation, and troubleshooting docs
16. **Update migration history** in `docs/architecture/database.md` to include migrations 008-010
17. **Fix `docs/architecture/db-schema-design.md`** status from "Proposed" to "Implemented" and correct `user_id` vs `created_by` discrepancy
18. **Fix token expiry claim** in troubleshooting.md from "24 hours" to "15 minutes (access) / 30 days (refresh)"
19. **Add Identity service** to installation guide, troubleshooting port table, and project structure
20. **Fix refresh token example** in troubleshooting.md to use request body format
21. **Update project structure** in `docs/development/project-structure.md` -- fix `handler/` to `handlers/`, add identity service, note deleted test files
22. **Fix README.md logo path** -- `docs/assets/orion-logo.svg` does not exist
23. **Standardize publisher platform documentation** -- decide between LinkedIn and Instagram

### Priority 4 -- Low (nice to have)

24. Document the onboarding flow (new feature)
25. Link or remove `docs/design-brief.md` from navigation
26. Update example timestamps from 2024 to 2026
27. Clarify production vs dev dashboard ports throughout docs
28. Verify and update development guide pages in `docs/development/`
29. Update README dashboard description from "dark-themed" to "glassmorphism design with light/dark themes"

---

## 6. Files Requiring Changes (Summary)

| File | Changes Needed |
|------|---------------|
| `docs/TECH_STACK.md` | Rewrite all version numbers |
| `docs/architecture/auth-current-state.md` | Delete or mark as superseded |
| `docs/architecture/security.md` | Fix roles, remove unimplemented endpoints, fix /metrics auth |
| `docs/architecture/database.md` | Add migrations 008-010 |
| `docs/architecture/db-schema-design.md` | Update status, fix user_id vs created_by |
| `docs/api/endpoints.md` | Remove unimplemented endpoints, fix /metrics auth |
| `docs/api/authentication.md` | Fix role values |
| `docs/api/websocket.md` | Document ticket-based auth |
| `docs/deployment/docker.md` | Fix PostgreSQL version, Go version, pip usage |
| `docs/deployment/production.md` | Remove ORION_ADMIN_PASS reference |
| `docs/getting-started/installation.md` | Fix git URL, add Identity, fix Black refs |
| `docs/getting-started/configuration.md` | Fix OAUTH_REDIRECT_BASE default |
| `docs/getting-started/troubleshooting.md` | Fix token expiry, add Identity port, fix refresh example |
| `docs/services/index.md` | Fix Redis buffering claim, fix event name |
| `docs/services/gateway.md` | Fix Go version, OAUTH_REDIRECT_BASE, WebSocket |
| `docs/development/project-structure.md` | Fix directory name, add Identity, update test files |
| `README.md` | Add Identity, fix Go version, fix formatter, fix dark theme description |
| `CLAUDE.md` | Fix Go version |
