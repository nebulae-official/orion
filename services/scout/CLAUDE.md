# Scout Service

Monitors external sources (RSS, social media, news APIs) to detect trending topics and signals for content generation.

## Dev

```bash
pip install -e .
uvicorn src.main:app --reload --port 8001
```

## Responsibilities
- Poll configured data sources on a schedule
- Score and rank topics by relevance
- Emit `TrendDetected` events to the event bus
