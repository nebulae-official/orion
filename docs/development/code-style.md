# Code Style

Orion enforces consistent code style across Go, Python, and TypeScript.

## :material-language-go: Go

### Conventions

- Standard library preferred; Chi for routing
- Error returns, never panic (except unrecoverable init failures)
- Wrap errors with context: `fmt.Errorf("operation: %w", err)`
- `slog` for structured logging
- `context.Context` as first parameter for I/O functions
- Use `errors.Is`/`errors.As` for error checking

### Linting

```bash
make lint  # Runs golangci-lint
```

### Handler Pattern

```go
func (h *Handler) GetTrends(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    trends, err := h.service.GetTrends(ctx, id)
    if err != nil {
        slog.ErrorContext(ctx, "failed to get trends", "error", err)
        http.Error(w, "Internal Server Error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(trends)
}
```

---

## :material-language-python: Python

### Conventions

- Type hints on **all** function signatures (params and return)
- Async functions for I/O operations (`async def`, `await`)
- Pydantic v2 for all data models
- `structlog` for logging (not stdlib `logging`)
- Repository pattern: routes -> service -> repository
- No business logic in route handlers

### Linting

```bash
# Lint and fix
ruff check --fix services/

# Format
ruff format services/

# Type check
mypy services/
```

### Model Pattern

```python
from pydantic import BaseModel, ConfigDict, Field


class TrendResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    topic: str
    score: float = Field(ge=0.0, le=1.0)
    status: str
```

### Service Pattern

```python
class TrendService:
    def __init__(self, repo: TrendRepository, bus: EventBus) -> None:
        self._repo = repo
        self._bus = bus

    async def create_trend(self, data: CreateTrendRequest) -> Trend:
        trend = await self._repo.create(data)
        await self._bus.publish("orion.trend.detected", trend.to_event())
        return trend
```

---

## :material-language-typescript: TypeScript / Next.js

### Conventions

- Strict TypeScript mode enabled
- App Router (not Pages Router)
- Server Components by default; `"use client"` only when needed
- Tailwind utility classes only (no CSS modules)
- Explicit return types on exported functions
- `interface` for object shapes, `type` for unions/intersections
- No `any` -- use `unknown` for truly unknown types

### Linting

```bash
cd dashboard && npm run lint
```

### Component Pattern

```tsx
interface TrendCardProps {
  id: string;
  topic: string;
  score: number;
}

export function TrendCard({ id, topic, score }: TrendCardProps): JSX.Element {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{topic}</h3>
      <p className="text-sm text-muted-foreground">Score: {score}</p>
    </div>
  );
}
```
