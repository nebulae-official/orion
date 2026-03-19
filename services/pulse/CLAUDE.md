# Pulse Service

Tracks analytics and performance metrics for published content — views, engagement, and conversion signals.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8005
```

## Responsibilities
- Ingest analytics events from the gateway
- Aggregate and store performance metrics in the database
- Surface insights to the director for content strategy decisions

## User Context
- Routes use `get_current_user()` dependency to extract the authenticated user from the `X-User-ID` header forwarded by the gateway
- Analytics and cost data are scoped by `user_id` for per-user data isolation
- The `user_id` column on analytics tables has a NOT NULL constraint
