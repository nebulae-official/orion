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
pip install pre-commit
pre-commit install
```

## :material-format-list-checks: Makefile Targets

| Target       | Command             | Description                                    |
| ------------ | ------------------- | ---------------------------------------------- |
| `make build` | `go build`          | Build Go binaries (`bin/gateway`, `bin/orion`) |
| `make test`  | `go test ./...`     | Run Go tests                                   |
| `make lint`  | `golangci-lint run` | Lint Go code                                   |
| `make run`   | `./bin/gateway`     | Run gateway locally                            |
| `make clean` | `rm -rf bin/`       | Remove build artifacts                         |

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
