# Director Service

Orchestrates the content creation pipeline — receives trend signals and coordinates scout, media, and editor services to produce content.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8002
```

## Responsibilities
- Receive `TrendDetected` events and decide whether to create content
- Spawn content creation workflows
- Track pipeline state and emit `ContentCreated` events
