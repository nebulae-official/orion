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
