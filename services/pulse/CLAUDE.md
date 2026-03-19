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
