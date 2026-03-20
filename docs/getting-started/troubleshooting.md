# Troubleshooting

Common issues and solutions when running Orion. Each section covers a specific layer of the stack with diagnostic commands and fixes.

## :material-docker: Docker Issues

### Services fail health checks

```bash
# Check which containers are unhealthy
docker compose -f deploy/docker-compose.yml ps

# View logs for a specific service
docker compose -f deploy/docker-compose.yml logs scout

# View logs with timestamps
docker compose -f deploy/docker-compose.yml logs -t scout

# Follow logs in real time across multiple services
docker compose -f deploy/docker-compose.yml logs -f scout director media

# Verify network connectivity between containers
docker compose -f deploy/docker-compose.yml exec scout ping postgres

# Check if a service can reach Redis
docker compose -f deploy/docker-compose.yml exec scout redis-cli -u redis://redis:6379 ping
```

!!! info "Health check timing"
All services have a 30-second interval with 3 retries. Allow up to 90 seconds for services to become healthy after startup. PostgreSQL and Milvus take longer on first run while initializing data directories.

### Port conflicts

If a port is already in use, find the conflicting process and either stop it or remap the port:

```bash
# Find what's using a port (Linux)
sudo lsof -i :8000
# or
sudo ss -tlnp | grep 8000

# Find what's using a port (macOS)
lsof -i :8000
```

Default port assignments:

| Service    | Default Port |
| ---------- | ------------ |
| Gateway    | 8000         |
| Scout      | 8001         |
| Director   | 8002         |
| Media      | 8003         |
| Editor     | 8004         |
| Pulse      | 8005         |
| Publisher  | 8006         |
| Dashboard  | 3000         |
| PostgreSQL | 5432         |
| Redis      | 6379         |
| Milvus     | 19530, 9091  |
| Ollama     | 11434        |
| ComfyUI    | 8188         |

### Container won't start

```bash
# View the exit code and error
docker compose -f deploy/docker-compose.yml ps -a

# Inspect a specific container
docker inspect $(docker compose -f deploy/docker-compose.yml ps -q scout)

# Rebuild a specific service image
docker compose -f deploy/docker-compose.yml build scout

# Rebuild all images from scratch (no cache)
docker compose -f deploy/docker-compose.yml build --no-cache
```

### Reset all data

```bash
# Stop services and remove all volumes
docker compose -f deploy/docker-compose.yml down -v

# Full cleanup: remove volumes, orphan containers, and images
docker compose -f deploy/docker-compose.yml down -v --remove-orphans --rmi local
```

!!! warning
The `-v` flag removes all named volumes (`pgdata`, `redisdata`, `milvusdata`, `ollamadata`). All data will be permanently lost. Re-run `./scripts/seed-db.sh` after restarting to restore initial data.

### Disk space issues

```bash
# Check Docker disk usage
docker system df

# Clean up unused images, containers, and volumes
docker system prune -a --volumes
```

---

## :material-connection: Connectivity Issues

### Gateway cannot reach services

Verify service URLs in `.env` match your runtime environment:

=== "Docker Compose"

    Use container hostnames (service names from `docker-compose.yml`):

    ```env
    SCOUT_URL=http://scout:8001
    DIRECTOR_URL=http://director:8002
    MEDIA_URL=http://media:8003
    EDITOR_URL=http://editor:8004
    PULSE_URL=http://pulse:8005
    PUBLISHER_URL=http://publisher:8006
    ```

=== "Local development"

    Use `localhost` with the correct port:

    ```env
    SCOUT_URL=http://localhost:8001
    DIRECTOR_URL=http://localhost:8002
    MEDIA_URL=http://localhost:8003
    EDITOR_URL=http://localhost:8004
    PULSE_URL=http://localhost:8005
    PUBLISHER_URL=http://localhost:8006
    ```

### Redis connection refused

```bash
# Verify Redis is running
redis-cli -u redis://localhost:6379 ping
# Expected: PONG

# Check Redis info
redis-cli -u redis://localhost:6379 info server

# List active pub/sub channels (should show orion.* channels)
redis-cli -u redis://localhost:6379 pubsub channels "orion.*"
```

### PostgreSQL authentication failed

Ensure credentials match between the database container and service environment:

```bash
# Test connection directly
psql -h localhost -U orion -d orion -c "SELECT 1;"

# Check which env vars are set
grep POSTGRES .env

# Verify the database exists
psql -h localhost -U orion -l
```

### Milvus connection issues

```bash
# Check Milvus health
curl http://localhost:9091/healthz

# Check Milvus metrics
curl http://localhost:9091/metrics | head -20
```

---

## :material-key: Authentication Issues

### JWT token expired

Tokens expire after 24 hours by default. Re-authenticate:

=== "CLI"

    ```bash
    orion auth login
    ```

=== "curl"

    ```bash
    # Refresh an existing token
    curl -X POST http://localhost:8000/api/v1/auth/refresh \
      -H "Authorization: Bearer $OLD_TOKEN"

    # Or get a new token
    TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@orion.local", "password": "orion_dev"}' \
      | jq -r '.access_token')
    ```

### 401 Unauthorized on all requests

Check that the `Authorization` header uses the correct `Bearer` prefix:

```bash
# Correct format
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  http://localhost:8000/api/v1/scout/api/v1/trends
```

### Check current auth status

```bash
orion auth whoami
# Shows: user, server URL, token expiry, and connection status
```

---

## :material-language-python: Python Service Issues

### Module not found errors

Ensure you installed the service and the shared library in editable mode:

```bash
cd services/scout
uv pip install -e ".[dev]"

# Also install the shared library if not already
cd ../../libs/orion-common
uv pip install -e ".[dev]"
```

### Database migration errors

```bash
# Check current migration state
cd services/scout
alembic current

# Run all pending migrations
alembic upgrade head

# View migration history
alembic history --verbose

# Downgrade one step (if needed)
alembic downgrade -1
```

### Type checking or linting failures

```bash
cd services/scout

# Run type checker
mypy src/

# Run linter with auto-fix
ruff check src/ --fix

# Run formatter
black src/ tests/
```

### Service won't start locally

```bash
# Check if the port is already in use
lsof -i :8001

# Run with verbose output
uvicorn src.main:app --reload --port 8001 --log-level debug

# Verify dependencies are installed
uv pip list | grep -i orion
```

---

## :material-language-go: Go Build Issues

### `make build` fails

```bash
# Verify Go version (requires 1.24+)
go version

# Download dependencies
go mod download

# Tidy modules
go mod tidy

# Clean and rebuild
make clean && make build
```

### Test failures

```bash
# Run tests with verbose output
go test -v ./...

# Run a specific test
go test -v -run TestHealthHandler ./internal/gateway/...

# Run tests with race detection
go test -race ./...
```

### Linter errors

```bash
# Run golangci-lint
make lint

# Run with verbose output for debugging
golangci-lint run ./... -v

# Auto-fix what's possible
golangci-lint run ./... --fix
```

---

## :material-nodejs: Dashboard Issues

### Build fails

```bash
cd dashboard

# Clean install (removes node_modules and reinstalls)
rm -rf node_modules .next
npm ci

# Check for TypeScript errors
npx tsc --noEmit

# Run linter
npm run lint
```

### Dashboard can't connect to gateway

Verify the gateway URL environment variable:

```bash
# Check what URL is configured
echo $NEXT_PUBLIC_GATEWAY_URL

# Default: http://localhost:8000
# Set it explicitly if needed
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000 npm run dev
```

### Hot reload not working

```bash
# Restart the dev server
npm run dev

# If on WSL2, try polling mode
WATCHPACK_POLLING=true npm run dev
```
