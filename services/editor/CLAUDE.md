# Editor Service

Generates and refines written content using local LLMs via Ollama.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8004
```

## Responsibilities
- Accept content briefs and generate long-form text via `OLLAMA_HOST`
- Apply style guides and brand voice constraints
- Return structured `Content` objects and emit `ContentCreated` events
