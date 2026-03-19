# Testing

Testing strategies and commands for Go, Python, and TypeScript components.

## :material-language-go: Go Tests

### Running Tests

```bash
# All Go tests
make test

# Specific package
go test ./internal/gateway/middleware/...

# With verbose output
go test -v ./...

# With race detection
go test -race ./...
```

### Test Patterns

Table-driven tests with `t.Run` subtests:

```go
func TestAuthMiddleware(t *testing.T) {
    tests := []struct {
        name       string
        token      string
        wantStatus int
    }{
        {"valid token", validJWT, http.StatusOK},
        {"expired token", expiredJWT, http.StatusUnauthorized},
        {"missing token", "", http.StatusUnauthorized},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            // ... test logic
        })
    }
}
```

Integration tests use `httptest.NewServer`:

```go
func TestHealthEndpoint(t *testing.T) {
    srv := httptest.NewServer(router.New(testConfig))
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/health")
    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

---

## :material-language-python: Python Tests

### Running Tests

```bash
# Per service
cd services/scout && pytest

# With coverage
cd services/scout && pytest --cov=src --cov-report=term-missing

# Specific test file
cd services/scout && pytest tests/test_trends.py

# Verbose
cd services/scout && pytest -v
```

### Test Patterns

Fixtures for database sessions and test clients:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

!!! note "Coverage target"
The project targets 80%+ code coverage for all Python services.

---

## :material-language-typescript: Dashboard Tests

### Running Tests

```bash
cd dashboard && npm test

# Watch mode
cd dashboard && npm run test:watch
```

---

## :material-test-tube: CLI Tests

```bash
# Run CLI tests
make cli-test

# Or directly
cd cli && uv run pytest
```

---

## :material-docker: E2E Tests

End-to-end tests validate the full service stack using mock servers and Docker Compose:

```bash
# Run E2E test suite
make test-e2e
```

This uses `deploy/docker-compose.e2e.yml` with mock servers in `tests/e2e/mocks/`. Tests cover:

- **Golden path** — Full pipeline from trend detection to publishing
- **Auth flow** — Login, token refresh, and authorization
- **Event flow** — Redis pub/sub event propagation between services
- **Error recovery** — Service failure handling and retry logic

---

## :material-speedometer: Performance Benchmarks

### pytest-benchmark

```bash
# Run benchmark suite
make bench
```

Benchmarks in `tests/benchmark/` measure:

- Gateway throughput (`test_gateway_throughput.py`)
- Event bus latency (`test_event_bus_latency.py`)
- Database query performance (`test_db_query_perf.py`)
- Pipeline end-to-end latency (`test_pipeline_latency.py`)

Baselines are stored in `tests/benchmark/baselines.json`.

### Locust load testing

```bash
# Start Locust web UI at :8089
make load-test
```

---

## :material-format-list-checks: Testing Checklist

| Component       | Tool             | Command          | Coverage Target |
| --------------- | ---------------- | ---------------- | --------------- |
| Go gateway      | `go test`        | `make test`      | --              |
| Python services | pytest           | `make py-test`   | 80%+            |
| CLI             | pytest           | `make cli-test`  | --              |
| Dashboard       | Jest/Vitest      | `make dash-test` | --              |
| E2E             | pytest + Docker  | `make test-e2e`  | --              |
| Benchmarks      | pytest-benchmark | `make bench`     | --              |
| Load testing    | Locust           | `make load-test` | --              |
