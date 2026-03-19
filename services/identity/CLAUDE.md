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
- Handle refresh token lifecycle (create, rotate, revoke)
- Send transactional emails (verification, reset, invite) — stubbed in dev
