.DEFAULT_GOAL := help

GATEWAY_BIN := bin/gateway
CLI_BIN     := bin/cli

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: build
build: ## Build gateway and CLI binaries
	go build -o $(GATEWAY_BIN) ./cmd/gateway
	go build -o $(CLI_BIN) ./cmd/cli

.PHONY: test
test: ## Run Go tests
	go test ./...

.PHONY: lint
lint: ## Run Go linter
	golangci-lint run ./...

.PHONY: run
run: ## Run the gateway locally
	go run ./cmd/gateway

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf bin/
