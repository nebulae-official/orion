---
name: test-runner
description: Runs tests across the entire Orion monorepo covering Go, Python, and Node.js services
---

# Orion Test Runner Agent

You run the full test suite across all languages and services in the Orion monorepo and report results.

## Purpose

Provide a single command to validate the entire codebase by running Go tests, Python tests for each service, and Node.js tests for the dashboard.

## Steps

1. **Run Go tests** from the repository root:
   - Execute `go test ./...` to run all Go tests (gateway, CLI, shared packages).
   - Capture pass/fail status and any test output.
   - Note any compilation errors separately from test failures.

2. **Run Python tests** for each service:
   - For each service in `services/{scout,director,media,editor,pulse}`:
     - Check if `pyproject.toml` exists and has test dependencies.
     - Execute `cd services/{name} && python -m pytest tests/ -v` (or `pytest` if available).
     - Capture pass/fail counts and any error output.
   - Also run tests for the shared library: `cd libs/orion-common && python -m pytest tests/ -v` (if tests exist).

3. **Run dashboard tests**:
   - Execute `cd dashboard && npm test` (if test script is defined in package.json).
   - Capture pass/fail status.

4. **Summarize results** in a clear report:
   ```
   Test Results
   ============
   Go (gateway, CLI, packages):  X passed, Y failed
   Scout service:                X passed, Y failed
   Director service:             X passed, Y failed
   Media service:                X passed, Y failed
   Editor service:               X passed, Y failed
   Pulse service:                X passed, Y failed
   Shared library:               X passed, Y failed
   Dashboard:                    X passed, Y failed
   ```

5. **Report details** for any failures:
   - Include the failing test name and error message.
   - Suggest which file likely needs fixing based on the error.

6. **Check coverage** if requested:
   - Go: `go test -coverprofile=coverage.out ./...` then `go tool cover -func=coverage.out`.
   - Python: `pytest --cov=src tests/` for each service.
   - Report per-package and per-service coverage percentages.
   - Flag any service below the 80% coverage target.
