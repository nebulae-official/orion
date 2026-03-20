# CI/CD

Orion uses GitHub Actions for continuous integration with plans for continuous deployment.

## :material-source-branch: Workflows

### CI (`ci.yml`)

Runs on pushes and pull requests to `main`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**Jobs:**

| Job             | Description                                      |
| --------------- | ------------------------------------------------ |
| `lint-python`   | Runs `ruff check` on `services/` and `shared/`   |
| `lint-frontend` | Runs `npm run lint` on `dashboard/` (if changed) |

### Build (`build.yml`)

Runs on pushes to `main` and version tags:

```yaml
name: Build
on:
  push:
    branches: [main]
    tags: ["v*"]
```

**Jobs:**

| Job     | Description                         |
| ------- | ----------------------------------- |
| `build` | Placeholder for Docker image builds |

## :material-hook: Pre-commit Hooks

The project uses pre-commit for local linting:

| Hook                 | Target                      | Tool          |
| -------------------- | --------------------------- | ------------- |
| Go linting           | `cmd/`, `internal/`, `pkg/` | golangci-lint |
| Python linting       | `services/`, `libs/`        | ruff          |
| Python type checking | `services/`, `libs/`        | mypy          |

Install hooks locally:

```bash
uv tool install pre-commit
pre-commit install
```

## :material-format-list-checks: Makefile Targets

| Target            | Command             | Description                                    |
| ----------------- | ------------------- | ---------------------------------------------- |
| `make build`      | `go build`          | Build Go gateway binary                        |
| `make test`       | `go test ./...`     | Run Go tests                                   |
| `make lint`       | `golangci-lint run` | Lint Go code                                   |
| `make run`        | `go run ./cmd/gateway` | Run gateway locally                         |
| `make clean`      | `rm -rf bin/`       | Remove build artifacts                         |
| `make py-test`    | per-service pytest  | Run Python tests for all services              |
| `make py-lint`    | ruff check          | Run ruff linter on all services                |
| `make py-format`  | ruff format         | Format all Python code                         |
| `make cli-test`   | pytest              | Run CLI tests                                  |
| `make cli-lint`   | ruff + mypy         | Lint and type-check CLI code                   |
| `make dash-test`  | npm test            | Run dashboard tests                            |
| `make dash-lint`  | npm run lint        | Lint dashboard code                            |
| `make test-all`   | all of the above    | Run all tests (Go + Python + CLI + Dashboard)  |
| `make check`      | all linters         | Run all linters and type checkers              |

## :material-git: Commit Convention

All commits follow the format:

```
type(ORION-{id}): description
```

| Type       | Description        |
| ---------- | ------------------ |
| `feat`     | New feature        |
| `fix`      | Bug fix            |
| `docs`     | Documentation      |
| `refactor` | Code restructuring |
| `test`     | Tests              |
| `chore`    | Maintenance        |

Example: `feat(ORION-15): implement ComfyUI WebSocket client`
