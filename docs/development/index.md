# :lucide-code: Development

Guide for developing and contributing to the Orion platform.

## :material-book-open-variant: Sections

<div class="grid cards" markdown>

-   :lucide-folder-tree: **[Project Structure](project-structure.md)**

    ---

    Repository layout and conventions

-   :lucide-plus-circle: **[Adding Services](adding-services.md)**

    ---

    How to create a new Python microservice

-   :lucide-test-tube: **[Testing](testing.md)**

    ---

    Testing strategies for Go, Python, and TypeScript

-   :lucide-palette: **[Code Style](code-style.md)**

    ---

    Linting, formatting, and code conventions

-   :lucide-database: **[Migrations](migrations.md)**

    ---

    Database schema migrations with Alembic

-   :lucide-git-branch: **[Git Workflow](git-workflow.md)**

    ---

    Branch strategy and commit conventions

</div>

## :material-tools: Quick Reference

### Build & Run

```bash
# Go
make build          # Build gateway + CLI
make run            # Run gateway locally
make test           # Run Go tests
make lint           # Run golangci-lint

# Python (per service)
cd services/scout
uv pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8001

# Dashboard
cd dashboard
npm ci && npm run dev

# Docker (everything)
docker compose -f deploy/docker-compose.yml up -d
```

### Common Tasks

| Task                | Command                                                     |
| ------------------- | ----------------------------------------------------------- |
| Start all services  | `docker compose -f deploy/docker-compose.yml up -d`         |
| View logs           | `docker compose -f deploy/docker-compose.yml logs -f scout` |
| Run Python tests    | `cd services/scout && pytest`                               |
| Run Go tests        | `make test`                                                 |
| Run dashboard tests | `cd dashboard && npm test`                                  |
| Run migrations      | `cd services/scout && alembic upgrade head`                 |
| Lint Python         | `ruff check services/`                                      |
| Lint Go             | `make lint`                                                 |
