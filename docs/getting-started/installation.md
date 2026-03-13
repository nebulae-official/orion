# Installation

This guide covers every method of setting up Orion — from a quick Docker-only deployment to a full local development environment with Go, Python, and Node.js toolchains.

## :material-source-repository: Clone the Repository

```bash
git clone https://github.com/orion-platform/orion.git
cd orion
```

## :material-script: Automated Setup

The setup script checks all prerequisites, installs dependencies, and creates your `.env` file:

```bash
./scripts/setup.sh
```

This script will:

- Verify Go 1.24+, Python 3.13+, and Node.js 22+ are installed
- Run `go mod download` to fetch Go dependencies
- Run `npm ci` in the dashboard directory
- Copy `.env.example` to `.env` if it doesn't already exist

---

## :material-docker: Docker Setup (Recommended)

The fastest way to get Orion running. No local toolchain required beyond Docker.

### 1. Copy the environment template

```bash
cp .env.example .env
```

Review and adjust values in `.env` as needed. See [Configuration](configuration.md) for all available variables.

### 2. Start services

=== "Core services only"

    Start the gateway, all Python services, and infrastructure (PostgreSQL, Redis, Milvus):

    ```bash
    docker compose -f deploy/docker-compose.yml up -d
    ```

=== "Full stack with AI"

    Include Ollama (LLM inference) and ComfyUI (image generation):

    ```bash
    docker compose -f deploy/docker-compose.yml --profile full up -d
    ```

=== "Development mode"

    Hot reload for all services — code changes are reflected immediately:

    ```bash
    docker compose -f deploy/docker-compose.yml \
      -f deploy/docker-compose.dev.yml up
    ```

### 3. Verify services are running

```bash
# Quick health check on the gateway
curl http://localhost:8000/health
```

Expected response:

```json
{ "status": "ok", "service": "gateway", "version": "0.1.0" }
```

### 4. Check all service health

```bash
# View the status of every container
docker compose -f deploy/docker-compose.yml ps

# Check health of all services through the gateway
docker compose -f deploy/docker-compose.yml exec gateway ./bin/orion health --all

# View logs for a specific service
docker compose -f deploy/docker-compose.yml logs scout --tail 50

# Follow logs in real time
docker compose -f deploy/docker-compose.yml logs -f scout director

# Stop all services
docker compose -f deploy/docker-compose.yml down

# Stop and remove all data volumes (full reset)
docker compose -f deploy/docker-compose.yml down -v
```

---

## :material-language-go: Go Development Setup

Required for working on the Gateway or CLI.

### Build binaries

```bash
# Build both gateway and CLI
make build

# Build just the gateway
go build -o bin/gateway ./cmd/gateway

# Build just the CLI with version info
make build
```

The `make build` command produces two binaries:

| Binary    | Path          | Purpose             |
| --------- | ------------- | ------------------- |
| `gateway` | `bin/gateway` | HTTP gateway server |
| `orion`   | `bin/orion`   | CLI tool            |

### Run and test

```bash
# Run the gateway locally
make run

# Run the gateway with a custom port
GATEWAY_PORT=9000 go run ./cmd/gateway

# Run all Go tests
make test

# Run tests with verbose output
go test -v ./...

# Run tests for a specific package
go test ./internal/gateway/...

# Run Go linter
make lint

# Clean build artifacts
make clean

# Check CLI version
./bin/orion version
```

---

## :material-language-python: Python Development Setup

Required for working on any of the six Python services: Scout, Director, Media, Editor, Pulse, and Publisher.

### Set up a service

```bash
# Navigate to a service
cd services/scout

# Create a virtual environment and install dependencies with uv
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
```

Repeat for each service you want to develop on: `scout`, `director`, `media`, `editor`, `pulse`, `publisher`.

!!! warning "Use uv, not pip"
All Python package management uses [uv](https://docs.astral.sh/uv/) for faster, more reliable installs. Do not use `pip install` directly.

### Run and test a service

```bash
# Run a service locally with hot reload
cd services/scout
uvicorn src.main:app --reload --port 8001

# Run tests
pytest

# Run tests with coverage report
pytest --cov=src --cov-report=term-missing

# Run type checking
mypy src/

# Run linter
ruff check src/

# Run formatter
black src/ tests/

# Run all checks (lint + type check + format check)
ruff check src/ && mypy src/ && black --check src/ tests/
```

### Install the shared library

All services depend on `libs/orion-common/`. When developing locally, install it in editable mode:

```bash
cd libs/orion-common
uv pip install -e ".[dev]"
```

---

## :material-nodejs: Dashboard Setup

```bash
cd dashboard
npm ci
npm run dev
```

The dashboard runs on `http://localhost:3000` and connects to the gateway at `NEXT_PUBLIC_GATEWAY_URL` (defaults to `http://localhost:8000`).

### Dashboard commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

---

## :material-database: Infrastructure Services

These are automatically started by Docker Compose but can be run independently for development:

| Service       | Port                      | Docker Volume | Purpose                              |
| ------------- | ------------------------- | ------------- | ------------------------------------ |
| PostgreSQL 17 | 5432                      | `pgdata`      | Primary datastore for all services   |
| Redis 7.4     | 6379                      | `redisdata`   | Event bus (pub/sub) and caching      |
| Milvus 2.4    | 19530 (gRPC), 9091 (HTTP) | `milvusdata`  | Vector similarity search for content |
| Ollama        | 11434                     | `ollamadata`  | Local LLM inference                  |
| ComfyUI       | 8188                      | —             | Local image generation               |

### Seed the database

After starting PostgreSQL for the first time, seed it with initial data:

```bash
./scripts/seed-db.sh
```

### Connect to infrastructure directly

```bash
# Connect to PostgreSQL
psql -h localhost -U orion -d orion

# Test Redis connection
redis-cli -u redis://localhost:6379 ping

# Check Ollama models
curl http://localhost:11434/api/tags

# Verify Milvus is running
curl http://localhost:9091/healthz
```
