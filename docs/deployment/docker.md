# Docker

All Orion services are containerized and orchestrated via Docker Compose.

## :material-docker: Compose Files

| File                            | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `deploy/docker-compose.yml`     | Main compose file with all services             |
| `deploy/docker-compose.dev.yml` | Development overrides (hot reload, debug ports) |

## :material-play: Starting Services

=== "Core only"

    ```bash
    docker compose -f deploy/docker-compose.yml up -d
    ```

=== "With AI services"

    ```bash
    docker compose -f deploy/docker-compose.yml --profile full up -d
    ```

=== "GPU-accelerated"

    ```bash
    docker compose -f deploy/docker-compose.yml --profile gpu up -d
    ```

=== "Development"

    ```bash
    docker compose -f deploy/docker-compose.yml \
      -f deploy/docker-compose.dev.yml up
    ```

## :material-view-grid: Service Configuration

### Application Services

| Service   | Image Base              | Port | Health Check  |
| --------- | ----------------------- | ---- | ------------- |
| gateway   | Go multi-stage (Alpine) | 8000 | `GET /health` |
| scout     | python:3.13-slim        | 8001 | `GET /health` |
| director  | python:3.13-slim        | 8002 | `GET /health` |
| media     | python:3.13-slim        | 8003 | `GET /health` |
| editor    | python:3.13-slim        | 8004 | `GET /health` |
| pulse     | python:3.13-slim        | 8005 | `GET /health` |
| publisher | python:3.13-slim        | 8006 | `GET /health` |
| dashboard | node:22-alpine          | 3000 | `GET /`       |

### Infrastructure Services

| Service  | Image                | Port        | Volume       |
| -------- | -------------------- | ----------- | ------------ |
| postgres | postgres:16-alpine   | 5432        | `pgdata`     |
| redis    | redis:7.4-alpine     | 6379        | `redisdata`  |
| milvus   | milvusdb/milvus:v2.4 | 19530, 9091 | `milvusdata` |
| ollama   | ollama/ollama        | 11434       | `ollamadata` |
| comfyui  | --                   | 8188        | --           |

## :material-harddisk: Volumes

```yaml
volumes:
  pgdata: # PostgreSQL persistent data
  redisdata: # Redis AOF persistence
  milvusdata: # Milvus vectors and ETCD
  ollamadata: # Downloaded LLM models
```

## :material-network: Networking

All services communicate over a single bridge network:

```yaml
networks:
  orion-net:
    driver: bridge
```

- Services reference each other by container name (e.g., `http://scout:8001`)
- Only the gateway (8000) and dashboard (3000) are exposed to the host
- Infrastructure ports (5432, 6379, 19530) are exposed for local development

## :material-heart-pulse: Health Checks

All services have standardized health check configuration:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

## :material-image: Dockerfile Patterns

### Go Services (Gateway)

Multi-stage build for minimal image size:

```dockerfile
# Builder stage
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/gateway ./cmd/gateway

# Runtime stage
FROM alpine:3.19
RUN adduser -D -u 1000 appuser
COPY --from=builder /bin/gateway /bin/gateway
USER appuser
ENTRYPOINT ["/bin/gateway"]
```

### Python Services

Slim base with non-root user:

```dockerfile
FROM python:3.13-slim
RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER appuser
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "800X"]
```

### Dashboard

Alpine Node.js with production build:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/package*.json ./
RUN npm ci --production
CMD ["npm", "start"]
```

## :material-cog: Environment Configuration

Services read configuration from `.env` via `env_file` in Docker Compose:

```yaml
services:
  scout:
    env_file: ../.env
    environment:
      - APP_ENV=development
```

!!! warning "Never commit `.env` files"
Use `.env.example` as a template. The `.env` file contains secrets and is in `.gitignore`.
