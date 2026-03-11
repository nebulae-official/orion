# Editor Service

Generates and refines written content using local LLMs via Ollama.

## Dev

```bash
pip install -e .
uvicorn src.main:app --reload --port 8004
```

## Responsibilities
- Accept content briefs and generate long-form text via `OLLAMA_HOST`
- Apply style guides and brand voice constraints
- Return structured `Content` objects and emit `ContentCreated` events
