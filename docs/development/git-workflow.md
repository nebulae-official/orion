# Git Workflow

Orion follows a trunk-based development model with the `main` branch as the primary integration branch.

## :material-source-branch: Branch Strategy

```mermaid
gitgraph
    commit id: "main"
    branch feat/ORION-42-scout-rss
    commit id: "feat: add RSS provider"
    commit id: "test: RSS provider tests"
    checkout main
    merge feat/ORION-42-scout-rss id: "PR #42"
    branch fix/ORION-43-auth-expiry
    commit id: "fix: token expiry check"
    checkout main
    merge fix/ORION-43-auth-expiry id: "PR #43"
```

### Branch Naming

```
{type}/ORION-{ticket}-{short-description}
```

Examples:

- `feat/ORION-42-scout-rss-provider`
- `fix/ORION-43-auth-token-expiry`
- `refactor/ORION-44-director-cleanup`

## :material-git: Commit Convention

All commits follow the format:

```
type(ORION-{id}): description
```

| Type       | When to Use                             |
| ---------- | --------------------------------------- |
| `feat`     | New feature or functionality            |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation changes                   |
| `refactor` | Code restructuring (no behavior change) |
| `test`     | Adding or updating tests                |
| `chore`    | Build, CI, config, dependencies         |

**Examples:**

```
feat(ORION-15): implement ComfyUI WebSocket client
fix(ORION-23): handle expired JWT tokens gracefully
test(ORION-95): add comprehensive Media service tests
chore(ORION-95): add pre-commit config with golangci-lint, ruff, mypy
```

## :material-source-pull: Pull Request Flow

1. Create a feature branch from `main`
2. Make changes with well-structured commits
3. Push and open a PR against `main`
4. CI runs automatically (lint-python, lint-frontend)
5. Code review
6. Merge to `main`

## :material-hook: Pre-commit Hooks

The project uses pre-commit to enforce quality before commits:

```bash
# Install hooks
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

Configured hooks:

| Hook                 | Language | Tool          |
| -------------------- | -------- | ------------- |
| Go linting           | Go       | golangci-lint |
| Python linting       | Python   | ruff          |
| Python type checking | Python   | mypy          |

## :material-format-list-checks: PR Checklist

- [ ] Branch follows naming convention
- [ ] Commits follow commit convention
- [ ] Tests pass locally
- [ ] Pre-commit hooks pass
- [ ] New code has tests (80%+ coverage for Python)
- [ ] No secrets in code (check `.env` not committed)
- [ ] Documentation updated if needed
