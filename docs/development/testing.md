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

## :material-docker: Integration Tests

Docker Compose integration tests validate the full service stack:

```bash
# Start services
docker compose -f deploy/docker-compose.yml up -d

# Wait for health
./bin/orion health --all

# Run integration tests
go test -tags=integration ./tests/integration/...

# Tear down
docker compose -f deploy/docker-compose.yml down
```

---

## :material-format-list-checks: Testing Checklist

| Component       | Tool        | Command                     | Coverage Target |
| --------------- | ----------- | --------------------------- | --------------- |
| Go gateway      | `go test`   | `make test`                 | --              |
| Python services | pytest      | `pytest` per service        | 80%+            |
| Dashboard       | Jest/Vitest | `npm test`                  | --              |
| Integration     | Docker + Go | `go test -tags=integration` | --              |
