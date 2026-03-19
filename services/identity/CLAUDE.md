# Identity Service

Manages user accounts, authentication, and authorization for the Orion platform.

## Dev

```bash
uv sync
uv run uvicorn src.identity.main:app --reload --port 8007
```

## Responsibilities
- Authenticate users (password + OAuth) via internal routes called by the gateway
- Manage user profiles, settings, and roles
- Handle refresh token lifecycle (create, rotate, revoke) with family-based theft detection
- Send transactional emails (verification, reset, invite) — stubbed in dev

## Architecture
- Routes → Service → Repository → Database (standard repository pattern)
- Internal routes (`/internal/*`) are called only by the gateway, not exposed externally
- Public routes (`/api/v1/identity/*`) are proxied through the gateway with JWT auth
- Password hashing uses bcrypt with cost factor 12
- Refresh tokens are opaque strings with 30-day expiry and family tracking

## Database Tables
- `users` — User accounts (id, email, name, password_hash, role, status)
- `refresh_tokens` — Opaque tokens with family tracking for theft detection
- `oauth_accounts` — Provider links (provider, provider_user_id, user_id)
