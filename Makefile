.DEFAULT_GOAL := help

# ==============================================================================
# Variables
# ==============================================================================

GATEWAY_BIN := bin/gateway
COMPOSE     := docker compose -f deploy/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f deploy/docker-compose.dev.yml
COMPOSE_MON := $(COMPOSE) -f deploy/docker-compose.monitoring.yml
SERVICES    := scout director media editor pulse publisher

VERSION   ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT    ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILDDATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

# ==============================================================================
# Help
# ==============================================================================

.PHONY: help
help: ## Show available targets
	@echo ""
	@echo "  Orion — Digital Twin Content Agency"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ==============================================================================
# Go — Build, Run, Test, Lint
# ==============================================================================

.PHONY: build
build: ## Build gateway binary
	go build -o $(GATEWAY_BIN) ./cmd/gateway

.PHONY: run
run: ## Run the gateway locally
	go run ./cmd/gateway

.PHONY: test
test: ## Run all Go tests
	go test ./...

.PHONY: test-verbose
test-verbose: ## Run Go tests with verbose output
	go test -v ./...

.PHONY: test-race
test-race: ## Run Go tests with race detector
	go test -race ./...

.PHONY: lint
lint: ## Run Go linter (golangci-lint)
	golangci-lint run ./...

.PHONY: lint-fix
lint-fix: ## Run Go linter with auto-fix
	golangci-lint run ./... --fix

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf bin/

# ==============================================================================
# CLI (Python/Typer)
# ==============================================================================

.PHONY: cli-dev
cli-dev: ## Run CLI in development mode
	cd cli && uv run orion $(ARGS)

.PHONY: cli-test
cli-test: ## Run CLI tests
	cd cli && uv run pytest

.PHONY: cli-lint
cli-lint: ## Run ruff and mypy on CLI
	cd cli && uv run ruff check src/ && uv run mypy src/

.PHONY: cli-build
cli-build: ## Build CLI wheel
	cd cli && uv build

# ==============================================================================
# E2E Testing
# ==============================================================================

COMPOSE_E2E := $(COMPOSE) -f deploy/docker-compose.e2e.yml

.PHONY: test-e2e
test-e2e: ## Run E2E tests (starts Docker stack)
	uv run pytest tests/e2e/ -v -m e2e

# ==============================================================================
# Performance Benchmarks
# ==============================================================================

.PHONY: bench
bench: ## Run pytest-benchmark suite
	uv run --group benchmark pytest tests/benchmark/ -v --benchmark-only

.PHONY: load-test
load-test: ## Run Locust load test (opens web UI at :8089)
	cd tests/benchmark && uv run --group benchmark locust -f locustfile.py

# ==============================================================================
# Python — Test, Lint, Type-check
# ==============================================================================

.PHONY: py-test
py-test: ## Run Python tests for all services
	@for svc in $(SERVICES); do \
		echo "==> Testing $$svc"; \
		(cd services/$$svc && uv run pytest) || exit 1; \
	done

.PHONY: py-lint
py-lint: ## Run ruff linter on all services
	@for svc in $(SERVICES); do \
		echo "==> Linting $$svc"; \
		(cd services/$$svc && uv run ruff check src/) || exit 1; \
	done

.PHONY: py-lint-fix
py-lint-fix: ## Run ruff linter with auto-fix on all services
	@for svc in $(SERVICES); do \
		echo "==> Fixing $$svc"; \
		(cd services/$$svc && uv run ruff check src/ --fix); \
	done

.PHONY: py-typecheck
py-typecheck: ## Run mypy on all services
	@for svc in $(SERVICES); do \
		echo "==> Type-checking $$svc"; \
		(cd services/$$svc && uv run mypy src/) || exit 1; \
	done

.PHONY: py-format
py-format: ## Format all Python code with ruff
	@for svc in $(SERVICES); do \
		echo "==> Formatting $$svc"; \
		(cd services/$$svc && uv run ruff format src/ tests/); \
	done

# ==============================================================================
# Dashboard — Dev, Build, Test, Lint
# ==============================================================================

.PHONY: dash-dev
dash-dev: ## Start dashboard dev server (port 3002, demo data, clean build)
	@-fuser -k 3002/tcp 2>/dev/null || true
	@sleep 1
	cd dashboard && rm -rf .next && NEXT_PUBLIC_DEMO_MODE=true npx next dev -p 3002

.PHONY: dash-prod
dash-prod: dash-build ## Start dashboard production server (port 3001, no demo data)
	@-fuser -k 3001/tcp 2>/dev/null || true
	@sleep 1
	cd dashboard && npx next start -p 3001

.PHONY: dash-build
dash-build: ## Build dashboard for production
	cd dashboard && npm run build

.PHONY: dash-stop
dash-stop: ## Stop all running dashboard servers (ports 3001 and 3002)
	@-fuser -k 3001/tcp 2>/dev/null || true
	@-fuser -k 3002/tcp 2>/dev/null || true
	@sleep 1
	@echo "Dashboard servers stopped"

.PHONY: dash-test
dash-test: ## Run dashboard tests
	cd dashboard && npm test

.PHONY: dash-e2e
dash-e2e: ## Run Playwright E2E tests for dashboard
	cd dashboard && npx playwright test

.PHONY: dash-lint
dash-lint: ## Run dashboard linter
	cd dashboard && npm run lint

# ==============================================================================
# Documentation — Serve, Build, Clean
# ==============================================================================

.PHONY: docs
docs: ## Start docs dev server with live reload (port 8080)
	uv run --group docs zensical serve --dev-addr 0.0.0.0:8080

.PHONY: docs-build
docs-build: ## Build documentation site
	uv run --group docs zensical build

.PHONY: docs-clean
docs-clean: ## Remove built documentation
	rm -rf site/

# ==============================================================================
# Docker — Up, Down, Dev, Logs
# ==============================================================================

.PHONY: up
up: ## Start all services (Docker Compose)
	$(COMPOSE) up -d

.PHONY: up-full
up-full: ## Start all services including GPU (Ollama, ComfyUI)
	$(COMPOSE) --profile full up -d

.PHONY: up-dev
up-dev: ## Start in development mode (hot reload)
	$(COMPOSE_DEV) up

.PHONY: up-monitoring
up-monitoring: ## Start with monitoring stack (Prometheus, Grafana)
	$(COMPOSE_MON) up -d

.PHONY: up-tools
up-tools: ## Start database tools (pgAdmin + Databasus)
	$(COMPOSE) --profile tools up -d pgadmin databasus

.PHONY: down-tools
down-tools: ## Stop database tools
	$(COMPOSE) --profile tools down

.PHONY: down
down: ## Stop all services
	$(COMPOSE) down

.PHONY: down-clean
down-clean: ## Stop all services and remove volumes (full reset)
	$(COMPOSE) down -v --remove-orphans

.PHONY: logs
logs: ## Follow logs for all services
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## Show running containers and health status
	$(COMPOSE) ps

.PHONY: restart
restart: down up ## Restart all services

# ==============================================================================
# Database — Backup, Restore, Migrate
# ==============================================================================

.PHONY: db-backup
db-backup: ## Create a database backup
	./scripts/db-backup.sh

.PHONY: db-restore
db-restore: ## Restore database from backup (usage: make db-restore FILE=backups/orion_xxx.dump)
	./scripts/db-restore.sh $(FILE)

.PHONY: db-migrate
db-migrate: ## Run database migrations
	./scripts/db-migrate.sh

.PHONY: db-migrate-dry
db-migrate-dry: ## Show migration SQL without executing
	./scripts/db-migrate.sh --dry-run

# ==============================================================================
# Setup & Utilities
# ==============================================================================

.PHONY: setup
setup: ## Run initial project setup
	./scripts/setup.sh

.PHONY: seed
seed: ## Seed the database with initial data
	./scripts/seed-db.sh

.PHONY: seed-demo
seed-demo: ## Generate dummy data and print demo mode instructions
	python3 scripts/generate_dummy_data.py
	@echo ""
	@echo "Fixtures generated in scripts/fixtures/"
	@echo "Start dashboard with: NEXT_PUBLIC_DEMO_MODE=true make dash-dev"

.PHONY: metrics-collector
metrics-collector: ## Start WSL host metrics collector (for accurate Windows metrics)
	python3 scripts/wsl-metrics-collector.py

.PHONY: pre-commit
pre-commit: ## Run pre-commit hooks on all files
	pre-commit run --all-files

.PHONY: fmt
fmt: py-format ## Format all code (alias for py-format)

.PHONY: check
check: lint py-lint py-typecheck cli-lint dash-lint ## Run all linters and type checkers

.PHONY: test-all
test-all: test py-test cli-test dash-test ## Run all tests (Go + Python + CLI + Dashboard)
