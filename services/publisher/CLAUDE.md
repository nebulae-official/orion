# Publisher Service

Social media publishing service — posts approved content to connected platforms.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8006
```

## Responsibilities
- Manage social media account connections
- Publish approved content to platforms (X/Twitter, YouTube, TikTok)
- Track publishing history and status
- Run content safety checks before publishing

## User Context
- Routes use `get_current_user()` dependency to extract the authenticated user from the `X-User-ID` header forwarded by the gateway
- Publishing history and social account connections are scoped by `user_id` for per-user data isolation
- The `user_id` column on publishing tables has a NOT NULL constraint
