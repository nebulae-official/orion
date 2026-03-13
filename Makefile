.DEFAULT_GOAL := help

# ==============================================================================
# Variables
# ==============================================================================

GATEWAY_BIN := bin/gateway
CLI_BIN     := bin/orion
COMPOSE     := docker compose -f deploy/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f deploy/docker-compose.dev.yml
COMPOSE_MON := $(COMPOSE) -f deploy/docker-compose.monitoring.yml
SERVICES    := scout director media editor pulse publisher

VERSION   ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT    ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILDDATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS   := -X github.com/orion-rigel/orion/internal/cli/commands.version=$(VERSION) \
             -X github.com/orion-rigel/orion/internal/cli/commands.commit=$(COMMIT) \
             -X github.com/orion-rigel/orion/internal/cli/commands.buildDate=$(BUILDDATE)

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
build: ## Build gateway and CLI binaries
	go build -o $(GATEWAY_BIN) ./cmd/gateway
	go build -ldflags "$(LDFLAGS)" -o $(CLI_BIN) ./cmd/cli

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
py-format: ## Format all Python code with black
	@for svc in $(SERVICES); do \
		echo "==> Formatting $$svc"; \
		(cd services/$$svc && uv run black src/ tests/); \
	done

# ==============================================================================
# Dashboard — Dev, Build, Test, Lint
# ==============================================================================

.PHONY: dash-dev
dash-dev: ## Start dashboard dev server
	cd dashboard && npm run dev

.PHONY: dash-build
dash-build: ## Build dashboard for production
	cd dashboard && npm run build

.PHONY: dash-test
dash-test: ## Run dashboard tests
	cd dashboard && npm test

.PHONY: dash-lint
dash-lint: ## Run dashboard linter
	cd dashboard && npm run lint

# ==============================================================================
# Documentation — Serve, Build, Clean
# ==============================================================================

.PHONY: docs
docs: ## Start docs dev server with live reload
	uv run --group docs zensical serve

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
# Setup & Utilities
# ==============================================================================

.PHONY: setup
setup: ## Run initial project setup
	./scripts/setup.sh

.PHONY: seed
seed: ## Seed the database with initial data
	./scripts/seed-db.sh

.PHONY: pre-commit
pre-commit: ## Run pre-commit hooks on all files
	pre-commit run --all-files

.PHONY: fmt
fmt: py-format ## Format all code (alias for py-format)

.PHONY: check
check: lint py-lint py-typecheck dash-lint ## Run all linters and type checkers

.PHONY: test-all
test-all: test py-test dash-test ## Run all tests (Go + Python + Dashboard)
