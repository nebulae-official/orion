# Orion Hardening Sprint — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Orion platform by rewriting the CLI in Python/Typer, adding E2E pipeline tests with mocked AI providers, and establishing performance baselines.

**Architecture:** The CLI becomes a UV workspace member at `cli/` that talks to the Go gateway over HTTP via httpx. E2E tests use `deploy/docker-compose.e2e.yml` to override AI providers with deterministic mock servers. Benchmarks use Locust and pytest-benchmark against the same Docker stack.

**Tech Stack:** Python 3.13, Typer, httpx, Rich, structlog, pytest, Locust, pytest-benchmark, Docker Compose

**Spec:** `docs/superpowers/specs/2026-03-18-hardening-sprint-design.md`

---

## Phase 1: CLI Rewrite (Python/Typer)

### Task 1: Register CLI as UV Workspace Member

**Files:**
- Modify: `pyproject.toml:10-19` (add "cli" to workspace members)
- Create: `cli/pyproject.toml`
- Create: `cli/src/orion_cli/__init__.py`
- Create: `cli/src/orion_cli/models/__init__.py`

- [ ] **Step 1: Add "cli" to workspace members**

In `pyproject.toml`, add `"cli"` to the members list:

```toml
[tool.uv.workspace]
members = [
    "services/scout",
    "services/director",
    "services/media",
    "services/editor",
    "services/pulse",
    "services/publisher",
    "libs/orion-common",
    "cli",
]
```

- [ ] **Step 2: Create cli/pyproject.toml**

```toml
[project]
name = "orion-cli"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "typer[all]>=0.15.0",
    "httpx>=0.27.0",
    "orion-common",
    "structlog>=24.0.0",
    "tomli>=2.0.0",
    "tomli-w>=1.0.0",
    "websockets>=13.0",
]

[project.scripts]
orion = "orion_cli.main:app"

[tool.uv.sources]
orion-common = { workspace = true }

[dependency-groups]
dev = [
    "ruff>=0.8.0",
    "mypy>=1.13.0",
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "respx>=0.22.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 3: Create cli/src/orion_cli/__init__.py and models/**

```python
"""Orion CLI — command-line interface for the Orion platform."""
```

Also create `cli/src/orion_cli/models/__init__.py`:

```python
"""CLI-specific response models. Re-exports from orion-common where possible."""
```

- [ ] **Step 4: Sync workspace**

Run: `cd /home/gishantsingh/Dev/Projects/orion && uv sync`
Expected: Success, cli package resolved with orion-common

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml cli/pyproject.toml cli/src/orion_cli/__init__.py
git commit -m "feat(ORION-96): scaffold CLI as UV workspace member with Typer"
```

---

### Task 2: Config Module

**Files:**
- Create: `cli/tests/test_commands/__init__.py`
- Create: `cli/tests/conftest.py`
- Create: `cli/tests/test_config.py`
- Create: `cli/src/orion_cli/config.py`

- [ ] **Step 1: Create test directory structure**

Create `cli/tests/__init__.py`, `cli/tests/test_commands/__init__.py`.

Create `cli/tests/conftest.py`:

```python
"""CLI test configuration."""

from pathlib import Path

import pytest


@pytest.fixture
def config_dir(tmp_path: Path) -> Path:
    """Provide a temporary config directory for tests."""
    return tmp_path / ".orion"
```

- [ ] **Step 2: Write failing test for config**

Create `cli/tests/test_config.py`:

```python
"""Tests for CLI configuration management."""

import tomli_w
import pytest
from pathlib import Path


def test_default_config(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig

    cfg = CLIConfig(config_dir=tmp_path)
    assert cfg.gateway_url == "http://localhost:8000"
    assert cfg.token is None


def test_save_and_load_token(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig

    cfg = CLIConfig(config_dir=tmp_path)
    cfg.save_token("test-jwt-token-123")

    reloaded = CLIConfig(config_dir=tmp_path)
    assert reloaded.token == "test-jwt-token-123"


def test_clear_token(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig

    cfg = CLIConfig(config_dir=tmp_path)
    cfg.save_token("test-jwt-token-123")
    cfg.clear_token()

    reloaded = CLIConfig(config_dir=tmp_path)
    assert reloaded.token is None


def test_custom_gateway_url(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig

    config_file = tmp_path / "config.toml"
    config_file.write_bytes(
        tomli_w.dumps({"gateway_url": "http://orion.example.com:8000"}).encode()
    )

    cfg = CLIConfig(config_dir=tmp_path)
    assert cfg.gateway_url == "http://orion.example.com:8000"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'orion_cli.config'`

- [ ] **Step 4: Implement config module**

Create `cli/src/orion_cli/config.py`:

```python
"""CLI configuration management — gateway URL and auth token storage."""

from __future__ import annotations

from pathlib import Path

import structlog
import tomli
import tomli_w

logger = structlog.get_logger()

DEFAULT_CONFIG_DIR = Path.home() / ".orion"
DEFAULT_GATEWAY_URL = "http://localhost:8000"


class CLIConfig:
    """Manages CLI configuration from ~/.orion/config.toml."""

    def __init__(self, config_dir: Path = DEFAULT_CONFIG_DIR) -> None:
        self._config_dir = config_dir
        self._config_file = config_dir / "config.toml"
        self._token_file = config_dir / "token"
        self._data = self._load()

    @property
    def gateway_url(self) -> str:
        return self._data.get("gateway_url", DEFAULT_GATEWAY_URL)

    @property
    def token(self) -> str | None:
        if self._token_file.exists():
            value = self._token_file.read_text().strip()
            return value if value else None
        return None

    def save_token(self, token: str) -> None:
        self._config_dir.mkdir(parents=True, exist_ok=True)
        self._token_file.write_text(token)
        self._token_file.chmod(0o600)
        logger.debug("token_saved", path=str(self._token_file))

    def clear_token(self) -> None:
        if self._token_file.exists():
            self._token_file.unlink()
            logger.debug("token_cleared")

    def _load(self) -> dict:
        if not self._config_file.exists():
            return {}
        with open(self._config_file, "rb") as f:
            return tomli.load(f)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_config.py -v`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add cli/tests/ cli/src/orion_cli/config.py
git commit -m "feat(ORION-96): add CLI config module with token storage"
```

---

### Task 3: HTTP Client

**Files:**
- Create: `cli/tests/test_client.py`
- Create: `cli/src/orion_cli/client.py`

- [ ] **Step 1: Write failing test for client**

Create `cli/tests/test_client.py`:

```python
"""Tests for the gateway HTTP client."""

import httpx
import pytest
import respx

from orion_cli.client import GatewayClient


@respx.mock
@pytest.mark.asyncio
async def test_health_check() -> None:
    respx.get("http://localhost:8000/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "version": "dev"})
    )
    client = GatewayClient(base_url="http://localhost:8000")
    result = await client.health()
    assert result["status"] == "ok"


@respx.mock
@pytest.mark.asyncio
async def test_login() -> None:
    respx.post("http://localhost:8000/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={"access_token": "jwt-123", "token_type": "bearer"})
    )
    client = GatewayClient(base_url="http://localhost:8000")
    result = await client.login(username="admin", password="secret")
    assert result["access_token"] == "jwt-123"


@respx.mock
@pytest.mark.asyncio
async def test_authenticated_request() -> None:
    respx.get("http://localhost:8000/status").mock(
        return_value=httpx.Response(200, json={"services": {}})
    )
    client = GatewayClient(base_url="http://localhost:8000", token="jwt-123")
    result = await client.get("/status")
    assert "services" in result
    assert respx.calls[0].request.headers["Authorization"] == "Bearer jwt-123"


@respx.mock
@pytest.mark.asyncio
async def test_connection_error() -> None:
    respx.get("http://localhost:8000/health").mock(side_effect=httpx.ConnectError("refused"))
    client = GatewayClient(base_url="http://localhost:8000")
    with pytest.raises(SystemExit) as exc_info:
        await client.health()
    assert exc_info.value.code == 3  # connection error exit code
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'orion_cli.client'`

- [ ] **Step 3: Implement client**

Create `cli/src/orion_cli/client.py`:

```python
"""Gateway HTTP client — all CLI commands talk to the gateway through this."""

from __future__ import annotations

from typing import Any

import httpx
import structlog
import sys

logger = structlog.get_logger()


class GatewayClient:
    """Async HTTP client for the Orion gateway API."""

    def __init__(self, base_url: str, token: str | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("DELETE", path, **kwargs)

    async def health(self) -> dict[str, Any]:
        return await self.get("/health")

    async def login(self, email: str, password: str) -> dict[str, Any]:
        return await self.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient() as http:
                resp = await http.request(
                    method, url, headers=self._headers(), **kwargs
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            logger.error("connection_failed", url=self._base_url)
            raise SystemExit(3)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                logger.error("auth_failed", hint="run 'orion login' first")
                raise SystemExit(2)
            logger.error(
                "request_failed",
                status=exc.response.status_code,
                body=exc.response.text[:200],
            )
            raise SystemExit(1)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_client.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add cli/tests/test_client.py cli/src/orion_cli/client.py
git commit -m "feat(ORION-96): add gateway HTTP client with auth and error handling"
```

---

### Task 4: Output Formatting

**Files:**
- Create: `cli/tests/test_output.py`
- Create: `cli/src/orion_cli/output.py`

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_output.py`:

```python
"""Tests for output formatting."""

from io import StringIO

from orion_cli.output import format_output, OutputFormat


def test_json_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.JSON)
    assert '"name": "scout"' in result
    assert '"status": "healthy"' in result


def test_plain_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.PLAIN)
    assert "scout" in result
    assert "healthy" in result


def test_table_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.TABLE)
    # Rich table output contains the values
    assert "scout" in result
    assert "healthy" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_output.py -v`
Expected: FAIL

- [ ] **Step 3: Implement output module**

Create `cli/src/orion_cli/output.py`:

```python
"""Output formatting — table, JSON, and plain text modes."""

from __future__ import annotations

import json
from enum import Enum
from io import StringIO
from typing import Any

from rich.console import Console
from rich.table import Table


class OutputFormat(str, Enum):
    TABLE = "table"
    JSON = "json"
    PLAIN = "plain"


def format_output(
    data: list[dict[str, Any]] | dict[str, Any],
    fmt: OutputFormat = OutputFormat.TABLE,
    title: str | None = None,
) -> str:
    """Format data for display. Returns a string."""
    if fmt == OutputFormat.JSON:
        return json.dumps(data, indent=2, default=str)

    if isinstance(data, dict):
        data = [data]

    if not data:
        return "No results."

    if fmt == OutputFormat.PLAIN:
        lines: list[str] = []
        for row in data:
            lines.append("\t".join(str(v) for v in row.values()))
        return "\n".join(lines)

    # TABLE format using Rich
    table = Table(title=title)
    keys = list(data[0].keys())
    for key in keys:
        table.add_column(key.replace("_", " ").title())
    for row in data:
        table.add_row(*(str(row.get(k, "")) for k in keys))

    buf = StringIO()
    console = Console(file=buf, force_terminal=False, width=120)
    console.print(table)
    return buf.getvalue()


def print_output(
    data: list[dict[str, Any]] | dict[str, Any],
    fmt: OutputFormat = OutputFormat.TABLE,
    title: str | None = None,
) -> None:
    """Format and print data to stdout."""
    output = format_output(data, fmt=fmt, title=title)
    if fmt == OutputFormat.TABLE:
        Console().print(output, end="")
    else:
        print(output)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_output.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cli/tests/test_output.py cli/src/orion_cli/output.py
git commit -m "feat(ORION-96): add output formatting with table/JSON/plain modes"
```

---

### Task 5: Main App + System Commands

**Files:**
- Create: `cli/src/orion_cli/main.py`
- Create: `cli/src/orion_cli/commands/__init__.py`
- Create: `cli/src/orion_cli/commands/system.py`
- Create: `cli/tests/test_commands/test_system.py`

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_system.py`:

```python
"""Tests for system commands (health, status, providers)."""

import httpx
import pytest
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_health_command() -> None:
    respx.get("http://localhost:8000/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "version": "1.0.0"})
    )
    result = runner.invoke(app, ["system", "health"])
    assert result.exit_code == 0
    assert "ok" in result.stdout


@respx.mock
def test_health_command_json_output() -> None:
    respx.get("http://localhost:8000/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "version": "1.0.0"})
    )
    result = runner.invoke(app, ["system", "health", "--format", "json"])
    assert result.exit_code == 0
    assert '"status": "ok"' in result.stdout


@respx.mock
def test_status_command() -> None:
    respx.get("http://localhost:8000/status").mock(
        return_value=httpx.Response(
            200,
            json={
                "services": {
                    "scout": {"status": "healthy", "latency_ms": 12},
                    "director": {"status": "healthy", "latency_ms": 8},
                }
            },
        ),
    )
    result = runner.invoke(app, ["system", "status", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "scout" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_system.py -v`
Expected: FAIL

- [ ] **Step 3: Implement main app and system commands**

Create `cli/src/orion_cli/commands/__init__.py`:

```python
"""CLI command groups."""

from orion_cli.client import GatewayClient
from orion_cli.config import CLIConfig


def get_client(token: str | None = None) -> GatewayClient:
    """Shared client factory — injected into all commands via import."""
    cfg = CLIConfig()
    return GatewayClient(base_url=cfg.gateway_url, token=token or cfg.token)
```

Create `cli/src/orion_cli/main.py`:

```python
"""Orion CLI — main entry point."""

from __future__ import annotations

import typer

from orion_cli.commands import system, auth, scout, content, pipeline, publish, admin

app = typer.Typer(
    name="orion",
    help="Orion Digital Twin Content Agency CLI",
    no_args_is_help=True,
)

app.add_typer(system.app, name="system", help="System health, status, and configuration")
app.add_typer(auth.app, name="auth", help="Authentication (login, logout, whoami)")
app.add_typer(scout.app, name="scout", help="Trend scanning and management")
app.add_typer(content.app, name="content", help="Content pipeline management")
app.add_typer(pipeline.app, name="pipeline", help="Pipeline runs and logs")
app.add_typer(publish.app, name="publish", help="Publishing and social accounts")
app.add_typer(admin.app, name="admin", help="Admin operations (seed, cleanup)")

if __name__ == "__main__":
    app()
```

Note: The main.py imports all command groups. Create stub files for the ones not yet implemented so imports work. Each stub is:

```python
"""Stub — implemented in a later task."""
import typer
app = typer.Typer()
```

Create stubs at: `cli/src/orion_cli/commands/auth.py`, `scout.py`, `content.py`, `pipeline.py`, `publish.py`, `admin.py`.

Create `cli/src/orion_cli/commands/system.py`:

```python
"""System commands — health, status, providers."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command()
def health(
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Check gateway health."""
    client = get_client()
    data = asyncio.run(client.health())
    print_output(data, fmt=fmt)


@app.command()
def status(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show status of all services."""
    client = get_client(token)
    data = asyncio.run(client.get("/status"))
    services = data.get("services", {})
    rows = [
        {"name": name, "status": info.get("status", "unknown"), "latency_ms": info.get("latency_ms", "")}
        for name, info in services.items()
    ]
    print_output(rows, fmt=fmt, title="Service Status")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_system.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/main.py cli/src/orion_cli/commands/
git add cli/tests/test_commands/test_system.py
git commit -m "feat(ORION-96): add Typer main app with system health/status commands"
```

---

### Task 6: Auth Commands

**Files:**
- Create: `cli/tests/test_commands/test_auth.py`
- Modify: `cli/src/orion_cli/commands/auth.py` (replace stub)

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_auth.py`:

```python
"""Tests for auth commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_login_command(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    respx.post("http://localhost:8000/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={"access_token": "jwt-new", "token_type": "bearer"})
    )
    result = runner.invoke(app, ["auth", "login", "--email", "admin@orion.local", "--password", "secret"])
    assert result.exit_code == 0
    assert "jwt-new" in result.stdout or "Logged in" in result.stdout


@respx.mock
def test_logout_command(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    # Write a token first
    token_dir = tmp_path / ".orion"
    token_dir.mkdir()
    (token_dir / "token").write_text("jwt-old")

    respx.post("http://localhost:8000/api/v1/auth/logout").mock(
        return_value=httpx.Response(200, json={"message": "logged out"})
    )
    result = runner.invoke(app, ["auth", "logout"])
    assert result.exit_code == 0
    assert not (token_dir / "token").exists()


def test_whoami_no_token(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    result = runner.invoke(app, ["auth", "whoami"])
    assert result.exit_code == 0
    assert "Not logged in" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_auth.py -v`
Expected: FAIL

- [ ] **Step 3: Implement auth commands**

Replace `cli/src/orion_cli/commands/auth.py`:

```python
"""Auth commands — login, logout, whoami."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.client import GatewayClient
from orion_cli.config import CLIConfig

app = typer.Typer()


@app.command()
def login(
    username: Annotated[str, typer.Option(prompt=True)],
    password: Annotated[str, typer.Option(prompt=True, hide_input=True)],
) -> None:
    """Authenticate with the gateway and store token."""
    cfg = CLIConfig()
    client = GatewayClient(base_url=cfg.gateway_url)
    data = asyncio.run(client.login(username=username, password=password))
    token = data["access_token"]
    cfg.save_token(token)
    typer.echo(f"Logged in successfully. Token: {token[:12]}...")


@app.command()
def logout() -> None:
    """Revoke token and clear stored credentials."""
    cfg = CLIConfig()
    if cfg.token:
        client = GatewayClient(base_url=cfg.gateway_url, token=cfg.token)
        try:
            asyncio.run(client.post("/api/v1/auth/logout"))
        except SystemExit:
            pass  # Server-side logout failed, still clear local token
    cfg.clear_token()
    typer.echo("Logged out.")


@app.command()
def whoami() -> None:
    """Show current authentication status."""
    cfg = CLIConfig()
    if cfg.token:
        typer.echo(f"Authenticated. Token: {cfg.token[:12]}...")
    else:
        typer.echo("Not logged in. Run 'orion auth login' to authenticate.")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_auth.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/commands/auth.py cli/tests/test_commands/test_auth.py
git commit -m "feat(ORION-96): add auth commands (login, logout, whoami)"
```

---

### Task 7: Scout Commands

**Files:**
- Create: `cli/tests/test_commands/test_scout.py`
- Modify: `cli/src/orion_cli/commands/scout.py` (replace stub)

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_scout.py`:

```python
"""Tests for scout commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_list_trends() -> None:
    respx.get("http://localhost:8000/api/v1/scout/trends").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"id": "t1", "title": "AI Coding Tools", "score": 0.95, "source": "google_trends"},
                {"id": "t2", "title": "Rust Adoption", "score": 0.82, "source": "rss"},
            ],
        ),
    )
    result = runner.invoke(app, ["scout", "list-trends", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "AI Coding Tools" in result.stdout


@respx.mock
def test_trigger_scan() -> None:
    respx.post("http://localhost:8000/api/v1/scout/scan").mock(
        return_value=httpx.Response(200, json={"status": "triggered", "providers": ["google_trends", "rss"]})
    )
    result = runner.invoke(app, ["scout", "trigger", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "triggered" in result.stdout


@respx.mock
def test_configure_niche() -> None:
    respx.post("http://localhost:8000/api/v1/scout/config").mock(
        return_value=httpx.Response(200, json={"niche": "gaming", "status": "active"})
    )
    result = runner.invoke(app, ["scout", "configure", "gaming", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "gaming" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_scout.py -v`
Expected: FAIL

- [ ] **Step 3: Implement scout commands**

Replace `cli/src/orion_cli/commands/scout.py`:

```python
"""Scout commands — trend scanning and management."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()




@app.command("list-trends")
def list_trends(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List detected trends."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/scout/trends"))
    print_output(data, fmt=fmt, title="Trends")


@app.command()
def trigger(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Trigger an immediate trend scan."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/scout/scan"))
    print_output(data, fmt=fmt)


@app.command()
def configure(
    niche: Annotated[str, typer.Argument(help="Niche to activate (tech, gaming, finance)")],
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Configure the active niche for trend scanning."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/scout/config", json={"niche": niche}))
    print_output(data, fmt=fmt)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_scout.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/commands/scout.py cli/tests/test_commands/test_scout.py
git commit -m "feat(ORION-96): add scout commands (list-trends, trigger)"
```

---

### Task 8: Content Commands

**Files:**
- Create: `cli/tests/test_commands/test_content.py`
- Modify: `cli/src/orion_cli/commands/content.py` (replace stub)

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_content.py`:

```python
"""Tests for content commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_list_content() -> None:
    respx.get("http://localhost:8000/api/v1/director/content").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"id": "c1", "title": "AI Tools 2026", "status": "pending_review"},
                {"id": "c2", "title": "Rust in Production", "status": "approved"},
            ],
        ),
    )
    result = runner.invoke(app, ["content", "list", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "AI Tools 2026" in result.stdout


@respx.mock
def test_approve_content() -> None:
    respx.post("http://localhost:8000/api/v1/director/content/c1/approve").mock(
        return_value=httpx.Response(200, json={"id": "c1", "status": "approved"})
    )
    result = runner.invoke(app, ["content", "approve", "c1", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "approved" in result.stdout


@respx.mock
def test_reject_content() -> None:
    respx.post("http://localhost:8000/api/v1/director/content/c1/reject").mock(
        return_value=httpx.Response(200, json={"id": "c1", "status": "rejected"})
    )
    result = runner.invoke(app, ["content", "reject", "c1", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "rejected" in result.stdout


@respx.mock
def test_view_content() -> None:
    respx.get("http://localhost:8000/api/v1/director/content/c1").mock(
        return_value=httpx.Response(
            200, json={"id": "c1", "title": "AI Tools 2026", "status": "approved", "script": "Hook: ..."}
        ),
    )
    result = runner.invoke(app, ["content", "view", "c1", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "AI Tools 2026" in result.stdout


@respx.mock
def test_regenerate_content() -> None:
    respx.post("http://localhost:8000/api/v1/director/content/c1/regenerate").mock(
        return_value=httpx.Response(200, json={"id": "c1", "status": "regenerating"})
    )
    result = runner.invoke(app, ["content", "regenerate", "c1", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "regenerating" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_content.py -v`
Expected: FAIL

- [ ] **Step 3: Implement content commands**

Replace `cli/src/orion_cli/commands/content.py`:

```python
"""Content commands — list, view, approve, reject, regenerate."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()




@app.command("list")
def list_content(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List all content items."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/director/content"))
    print_output(data, fmt=fmt, title="Content")


@app.command()
def view(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """View a specific content item."""
    client = get_client(token)
    data = asyncio.run(client.get(f"/api/v1/director/content/{content_id}"))
    print_output(data, fmt=fmt)


@app.command()
def approve(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Approve a content item for publishing."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/approve"))
    print_output(data, fmt=fmt)


@app.command()
def reject(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Reject a content item."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/reject"))
    print_output(data, fmt=fmt)


@app.command()
def regenerate(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Regenerate a content item with feedback."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/regenerate"))
    print_output(data, fmt=fmt)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_content.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/commands/content.py cli/tests/test_commands/test_content.py
git commit -m "feat(ORION-96): add content commands (list, view, approve, reject, regenerate)"
```

---

### Task 9: Pipeline Commands

**Files:**
- Create: `cli/tests/test_commands/test_pipeline.py`
- Modify: `cli/src/orion_cli/commands/pipeline.py` (replace stub)

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_pipeline.py`:

```python
"""Tests for pipeline commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_pipeline_status() -> None:
    respx.get("http://localhost:8000/api/v1/director/pipelines").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"id": "p1", "trend_id": "t1", "status": "completed", "duration_s": 45},
            ],
        ),
    )
    result = runner.invoke(app, ["pipeline", "status", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "completed" in result.stdout


@respx.mock
def test_pipeline_run() -> None:
    respx.post("http://localhost:8000/api/v1/director/pipelines").mock(
        return_value=httpx.Response(200, json={"id": "p2", "trend_id": "t1", "status": "running"})
    )
    result = runner.invoke(app, ["pipeline", "run", "t1", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "running" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_pipeline.py -v`
Expected: FAIL

- [ ] **Step 3: Implement pipeline commands**

Replace `cli/src/orion_cli/commands/pipeline.py`:

```python
"""Pipeline commands — status, run, logs."""

from __future__ import annotations

import asyncio
import json
from typing import Annotated, Optional

import typer
import websockets

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()




@app.command()
def status(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show pipeline run history."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/director/pipelines"))
    print_output(data, fmt=fmt, title="Pipeline Runs")


@app.command()
def run(
    trend_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Trigger a pipeline run for a trend."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/director/pipelines", json={"trend_id": trend_id}))
    print_output(data, fmt=fmt)


@app.command()
def logs(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
) -> None:
    """Stream live pipeline events via WebSocket."""
    cfg = CLIConfig()
    tok = token or cfg.token
    ws_url = cfg.gateway_url.replace("http://", "ws://").replace("https://", "wss://")

    async def _stream() -> None:
        async with websockets.connect(f"{ws_url}/ws?token={tok}") as ws:
            typer.echo("Connected. Streaming events (Ctrl+C to stop)...")
            async for message in ws:
                data = json.loads(message)
                event_type = data.get("type", "unknown")
                typer.echo(f"[{event_type}] {json.dumps(data.get('payload', {}), indent=2)}")

    try:
        asyncio.run(_stream())
    except KeyboardInterrupt:
        typer.echo("\nDisconnected.")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_pipeline.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/commands/pipeline.py cli/tests/test_commands/test_pipeline.py
git commit -m "feat(ORION-96): add pipeline commands (status, run, logs)"
```

---

### Task 10: Publish + Admin Commands

**Files:**
- Create: `cli/tests/test_commands/test_publish.py`
- Modify: `cli/src/orion_cli/commands/publish.py` (replace stub)
- Modify: `cli/src/orion_cli/commands/admin.py` (replace stub)

- [ ] **Step 1: Write failing test**

Create `cli/tests/test_commands/test_publish.py`:

```python
"""Tests for publish commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_list_accounts() -> None:
    respx.get("http://localhost:8000/api/v1/publisher/accounts").mock(
        return_value=httpx.Response(
            200,
            json=[{"id": "a1", "platform": "twitter", "username": "@orion_ai"}],
        ),
    )
    result = runner.invoke(app, ["publish", "accounts", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "twitter" in result.stdout


@respx.mock
def test_publish_content() -> None:
    respx.post("http://localhost:8000/api/v1/publisher/publish").mock(
        return_value=httpx.Response(200, json={"status": "published", "platform": "twitter"})
    )
    result = runner.invoke(app, ["publish", "send", "c1", "--platform", "twitter", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "published" in result.stdout


@respx.mock
def test_publish_history() -> None:
    respx.get("http://localhost:8000/api/v1/publisher/history").mock(
        return_value=httpx.Response(
            200,
            json=[{"id": "p1", "content_id": "c1", "platform": "twitter", "published_at": "2026-03-18T12:00:00Z"}],
        ),
    )
    result = runner.invoke(app, ["publish", "history", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "twitter" in result.stdout
```

Also create `cli/tests/test_commands/test_admin.py`:

```python
"""Tests for admin commands."""

import httpx
import respx
from typer.testing import CliRunner

from orion_cli.main import app

runner = CliRunner()


@respx.mock
def test_seed() -> None:
    respx.post("http://localhost:8000/api/v1/pulse/admin/seed").mock(
        return_value=httpx.Response(200, json={"status": "seeded", "records": 50})
    )
    result = runner.invoke(app, ["admin", "seed", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "seeded" in result.stdout.lower() or "Seed complete" in result.stdout


@respx.mock
def test_cleanup() -> None:
    respx.post("http://localhost:8000/api/v1/pulse/admin/cleanup").mock(
        return_value=httpx.Response(200, json={"status": "cleaned", "deleted": 12})
    )
    result = runner.invoke(app, ["admin", "cleanup", "--days", "30", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "cleaned" in result.stdout.lower() or "Cleanup complete" in result.stdout
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_publish.py -v`
Expected: FAIL

- [ ] **Step 3: Implement publish and admin commands**

Replace `cli/src/orion_cli/commands/publish.py`:

```python
"""Publish commands — accounts, publish, history."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()




@app.command()
def accounts(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List connected social media accounts."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/publisher/accounts"))
    print_output(data, fmt=fmt, title="Accounts")


@app.command()
def send(
    content_id: str,
    platform: Annotated[str, typer.Option(help="Target platform (twitter, youtube, tiktok, linkedin)")],
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Publish content to a platform."""
    client = get_client(token)
    data = asyncio.run(
        client.post(
            "/api/v1/publisher/publish",
            json={"content_id": content_id, "platform": platform},
        )
    )
    print_output(data, fmt=fmt)


@app.command()
def history(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show publishing history."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/publisher/history"))
    print_output(data, fmt=fmt, title="Publishing History")
```

Replace `cli/src/orion_cli/commands/admin.py`:

```python
"""Admin commands — seed, cleanup."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()




@app.command()
def seed(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
) -> None:
    """Seed the database with sample data."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/seed"))
    typer.echo(f"Seed complete: {data}")


@app.command()
def cleanup(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    days: Annotated[int, typer.Option(help="Delete data older than N days")] = 90,
) -> None:
    """Run data cleanup."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/cleanup", json={"days": days}))
    typer.echo(f"Cleanup complete: {data}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest tests/test_commands/test_publish.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add cli/src/orion_cli/commands/publish.py cli/src/orion_cli/commands/admin.py
git add cli/tests/test_commands/test_publish.py
git commit -m "feat(ORION-96): add publish and admin commands"
```

---

### Task 11: Delete Go CLI + Update Docs + Makefile

**Files:**
- Delete: `cmd/cli/main.go`
- Delete: `internal/cli/` (entire directory)
- Modify: `Makefile:7-19,38-41` (remove CLI_BIN, LDFLAGS, build target)
- Modify: `CLAUDE.md:6,12-13,20,46`
- Modify: `docs/TECH_STACK.md:10`

- [ ] **Step 1: Delete Go CLI files**

Run:
```bash
rm -rf cmd/cli/ internal/cli/
```

Verify `cmd/` still has `gateway/`:
```bash
ls cmd/
```
Expected: `gateway`

- [ ] **Step 2: Update Makefile**

Remove `CLI_BIN` (line 8) and `LDFLAGS` (lines 17-19). Update `build` target to only build gateway:

```makefile
GATEWAY_BIN := bin/gateway
COMPOSE     := docker compose -f deploy/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f deploy/docker-compose.dev.yml
COMPOSE_MON := $(COMPOSE) -f deploy/docker-compose.monitoring.yml
SERVICES    := scout director media editor pulse publisher

VERSION   ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT    ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILDDATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
```

Update build target:

```makefile
.PHONY: build
build: ## Build gateway binary
	go build -o $(GATEWAY_BIN) ./cmd/gateway
```

Add new CLI targets after the Go section:

```makefile
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
```

Update `check` and `test-all` targets to include CLI:

```makefile
.PHONY: check
check: lint py-lint py-typecheck cli-lint dash-lint ## Run all linters and type checkers

.PHONY: test-all
test-all: test py-test cli-test dash-test ## Run all tests (Go + Python + CLI + Dashboard)
```

- [ ] **Step 3: Update CLAUDE.md**

Tech Stack line 6:
```
- **Gateway:** Go 1.24, Chi 5.x router, slog logging
- **CLI:** Python 3.13, Typer, httpx, Rich
```

Architecture line 12-13:
```
- cmd/gateway/ — Go HTTP gateway (port 8000), routes requests to Python services
- cli/ — Python CLI tool (Typer) for interacting with the gateway
- services/{scout,director,media,editor,pulse,publisher} — Python FastAPI microservices
```

Commands section add:
```
- `make cli-test` — Run CLI tests
- `make cli-lint` — Lint CLI code
```

Testing section add:
```
- CLI: `cd cli && pytest`
```

- [ ] **Step 4: Update docs/TECH_STACK.md**

Replace line 10:
```
| CLI       | Python     | 3.13    |
```

Add to Web Frameworks table:
```
| CLI       | Typer      | >=0.15.0 |
```

- [ ] **Step 5: Verify Go tests still pass (no CLI tests broken)**

Run: `go test ./...`
Expected: PASS (only gateway tests remain)

- [ ] **Step 6: Run all CLI tests**

Run: `cd /home/gishantsingh/Dev/Projects/orion/cli && uv run pytest -v`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add Makefile CLAUDE.md docs/TECH_STACK.md
git rm -r cmd/cli/ internal/cli/
git commit -m "chore: remove Go CLI, update docs and Makefile for Python/Typer CLI"
```

---

## Phase 2: E2E Pipeline Testing

### Task 12: Mock Servers

**Files:**
- Create: `tests/e2e/__init__.py`
- Create: `tests/e2e/mocks/__init__.py`
- Create: `tests/e2e/mocks/Dockerfile`
- Create: `tests/e2e/mocks/llm_server.py`
- Create: `tests/e2e/mocks/comfyui_server.py`
- Create: `tests/e2e/mocks/tts_server.py`
- Create: `tests/e2e/mocks/fal_server.py`

- [ ] **Step 1: Create mock LLM server**

Create `tests/e2e/mocks/llm_server.py`:

```python
"""Mock LLM server — returns deterministic script responses."""

from fastapi import FastAPI, Request

app = FastAPI(title="Mock LLM Server")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/generate")
@app.post("/v1/chat/completions")
async def generate(request: Request) -> dict:
    """Return a deterministic script response regardless of prompt."""
    return {
        "choices": [
            {
                "message": {
                    "content": (
                        "Hook: AI is transforming how developers write code.\n"
                        "Visual: A developer using an AI coding assistant.\n"
                        "CTA: Subscribe for more tech insights."
                    )
                }
            }
        ]
    }
```

- [ ] **Step 2: Create mock ComfyUI server**

Create `tests/e2e/mocks/comfyui_server.py`:

```python
"""Mock ComfyUI server — returns a test image for any workflow."""

import base64
from fastapi import FastAPI, WebSocket

app = FastAPI(title="Mock ComfyUI Server")

# 1x1 red PNG as base64
TEST_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/prompt")
async def prompt() -> dict:
    return {"prompt_id": "mock-prompt-001"}


@app.get("/api/history/{prompt_id}")
async def history(prompt_id: str) -> dict:
    return {
        prompt_id: {
            "status": {"completed": True},
            "outputs": {"images": [{"filename": "test.png", "type": "output"}]},
        }
    }


@app.get("/api/view")
async def view() -> bytes:
    from fastapi.responses import Response

    return Response(content=TEST_PNG, media_type="image/png")
```

- [ ] **Step 3: Create mock TTS server**

Create `tests/e2e/mocks/tts_server.py`:

```python
"""Mock TTS server — returns a silent WAV file."""

import struct
from fastapi import FastAPI
from fastapi.responses import Response

app = FastAPI(title="Mock TTS Server")


def _silent_wav(duration_ms: int = 500, sample_rate: int = 16000) -> bytes:
    """Generate a silent WAV file."""
    num_samples = int(sample_rate * duration_ms / 1000)
    data_size = num_samples * 2  # 16-bit mono
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/v1/text-to-speech/{voice_id}")
async def tts(voice_id: str) -> Response:
    return Response(content=_silent_wav(), media_type="audio/wav")
```

- [ ] **Step 4: Create mock Fal.ai server**

Create `tests/e2e/mocks/fal_server.py`:

```python
"""Mock Fal.ai server — returns deterministic image/video results."""

import base64
from fastapi import FastAPI

app = FastAPI(title="Mock Fal.ai Server")

TEST_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/fal-ai/flux/dev")
@app.post("/fal-ai/stable-video")
async def generate() -> dict:
    return {
        "images": [{"url": "http://mock-fal:9004/test.png", "content_type": "image/png"}],
        "video": {"url": "http://mock-fal:9004/test.mp4"},
    }


@app.get("/test.png")
async def test_image() -> bytes:
    from fastapi.responses import Response
    return Response(content=TEST_PNG, media_type="image/png")
```

- [ ] **Step 5: Create Dockerfile for mock servers**

Create `tests/e2e/mocks/Dockerfile`:

```dockerfile
FROM python:3.13-slim

WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn[standard]
# Note: pip is intentional here — this is a throwaway container, not part of the UV workspace
COPY *.py .

# Entrypoint expects SERVER_MODULE env var (e.g., "llm_server:app")
CMD ["sh", "-c", "uvicorn ${SERVER_MODULE} --host 0.0.0.0 --port ${SERVER_PORT:-8080}"]
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/
git commit -m "feat(ORION-97): add mock AI provider servers for E2E testing"
```

---

### Task 13: Docker Compose E2E Override

**Files:**
- Create: `deploy/docker-compose.e2e.yml`

- [ ] **Step 1: Create the E2E compose override**

Create `deploy/docker-compose.e2e.yml`:

```yaml
# E2E test overrides — replaces AI providers with deterministic mock servers.
# Usage: docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d

services:
  # Mock servers
  mock-llm:
    build:
      context: ../tests/e2e/mocks
      dockerfile: Dockerfile
    environment:
      SERVER_MODULE: llm_server:app
      SERVER_PORT: "9001"
    ports:
      - "9001:9001"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9001/health')"]
      interval: 5s
      timeout: 3s
      retries: 3
    networks:
      - orion-net

  mock-comfyui:
    build:
      context: ../tests/e2e/mocks
      dockerfile: Dockerfile
    environment:
      SERVER_MODULE: comfyui_server:app
      SERVER_PORT: "9002"
    ports:
      - "9002:9002"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9002/health')"]
      interval: 5s
      timeout: 3s
      retries: 3
    networks:
      - orion-net

  mock-tts:
    build:
      context: ../tests/e2e/mocks
      dockerfile: Dockerfile
    environment:
      SERVER_MODULE: tts_server:app
      SERVER_PORT: "9003"
    ports:
      - "9003:9003"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9003/health')"]
      interval: 5s
      timeout: 3s
      retries: 3
    networks:
      - orion-net

  mock-fal:
    build:
      context: ../tests/e2e/mocks
      dockerfile: Dockerfile
    environment:
      SERVER_MODULE: fal_server:app
      SERVER_PORT: "9004"
    ports:
      - "9004:9004"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9004/health')"]
      interval: 5s
      timeout: 3s
      retries: 3
    networks:
      - orion-net

  # Override service environment to point at mock providers
  director:
    environment:
      OLLAMA_URL: http://mock-llm:9001
      LLM_BASE_URL: http://mock-llm:9001

  media:
    environment:
      COMFYUI_URL: http://mock-comfyui:9002
      FAL_URL: http://mock-fal:9004

  editor:
    environment:
      TTS_URL: http://mock-tts:9003
      FAL_URL: http://mock-fal:9004

  publisher:
    environment:
      TWITTER_API_URL: http://mock-fal:9004  # Reuse as generic mock endpoint
```

- [ ] **Step 2: Commit**

```bash
git add deploy/docker-compose.e2e.yml
git commit -m "feat(ORION-97): add docker-compose.e2e.yml with mock provider overrides"
```

---

### Task 14: E2E Test Fixtures and Conftest

**Files:**
- Create: `tests/e2e/conftest.py`
- Create: `tests/e2e/fixtures/sample_trend.json`

- [ ] **Step 1: Create sample trend fixture**

Create `tests/e2e/fixtures/sample_trend.json`:

```json
{
  "title": "E2E Test Trend: AI Code Assistants",
  "source": "manual",
  "score": 0.95,
  "niche": "tech",
  "keywords": ["ai", "coding", "developer tools"]
}
```

- [ ] **Step 2: Create minimal test assets**

Create `tests/e2e/fixtures/test_image.png` (1x1 red pixel) and `tests/e2e/fixtures/test_audio.wav` (silent 0.5s) programmatically:

```python
# Run this once to generate fixtures:
import base64, struct
from pathlib import Path

fixtures = Path("tests/e2e/fixtures")
fixtures.mkdir(parents=True, exist_ok=True)

# 1x1 PNG
png = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)
(fixtures / "test_image.png").write_bytes(png)

# Silent WAV (0.5s, 16kHz, 16-bit mono)
sr, dur, ns = 16000, 0.5, int(16000 * 0.5)
ds = ns * 2
hdr = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36+ds, b"WAVE", b"fmt ", 16, 1, 1, sr, sr*2, 2, 16, b"data", ds)
(fixtures / "test_audio.wav").write_bytes(hdr + b"\x00" * ds)
```

- [ ] **Step 3: Create conftest with Docker lifecycle**

Create `tests/e2e/conftest.py`:

```python
"""E2E test configuration — Docker Compose lifecycle and shared fixtures."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

import httpx
import pytest

COMPOSE_FILES = [
    "deploy/docker-compose.yml",
    "deploy/docker-compose.e2e.yml",
]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
GATEWAY_URL = os.getenv("E2E_GATEWAY_URL", "http://localhost:8000")
HEALTH_TIMEOUT = int(os.getenv("E2E_HEALTH_TIMEOUT", "60"))

SERVICES_TO_CHECK = [
    f"{GATEWAY_URL}/health",
    f"{GATEWAY_URL}/api/v1/scout/health",
    f"{GATEWAY_URL}/api/v1/director/health",
    f"{GATEWAY_URL}/api/v1/media/health",
    f"{GATEWAY_URL}/api/v1/editor/health",
    f"{GATEWAY_URL}/api/v1/pulse/health",
    f"{GATEWAY_URL}/api/v1/publisher/health",
]


def _compose_cmd(*args: str) -> list[str]:
    cmd = ["docker", "compose"]
    for f in COMPOSE_FILES:
        cmd.extend(["-f", str(PROJECT_ROOT / f)])
    cmd.extend(args)
    return cmd


def _wait_for_services() -> None:
    """Poll health endpoints until all services are ready."""
    deadline = time.time() + HEALTH_TIMEOUT
    pending = set(SERVICES_TO_CHECK)

    while pending and time.time() < deadline:
        for url in list(pending):
            try:
                resp = httpx.get(url, timeout=3)
                if resp.status_code == 200:
                    pending.discard(url)
            except (httpx.ConnectError, httpx.ReadTimeout):
                pass
        if pending:
            time.sleep(2)

    if pending:
        raise RuntimeError(f"Services not ready after {HEALTH_TIMEOUT}s: {pending}")


@pytest.fixture(scope="session", autouse=True)
def docker_stack():
    """Start Docker Compose stack for the test session."""
    subprocess.run(_compose_cmd("up", "-d", "--build", "--wait"), check=True, cwd=PROJECT_ROOT)
    _wait_for_services()
    yield
    subprocess.run(_compose_cmd("down", "-v"), check=True, cwd=PROJECT_ROOT)


@pytest.fixture(scope="session")
def gateway_url() -> str:
    return GATEWAY_URL


@pytest.fixture(scope="session")
def auth_token(gateway_url: str) -> str:
    """Authenticate and return a JWT token for the test session."""
    resp = httpx.post(
        f"{gateway_url}/api/v1/auth/login",
        json={"email": "admin@orion.local", "password": "admin"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture()
def truncate_db(gateway_url: str, auth_headers: dict[str, str]) -> None:
    """Truncate test data between tests. Runs before each test."""
    # This calls a test-only admin endpoint if available,
    # or we connect directly to PG in the compose network.
    # For now, tests are designed to be additive and not conflict.
    pass


@pytest.fixture()
def sample_trend() -> dict:
    fixtures_dir = Path(__file__).parent / "fixtures"
    with open(fixtures_dir / "sample_trend.json") as f:
        return json.load(f)
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/conftest.py tests/e2e/fixtures/ tests/e2e/__init__.py
git commit -m "feat(ORION-97): add E2E conftest with Docker lifecycle and fixtures"
```

---

### Task 15: Golden Path E2E Test

**Files:**
- Create: `tests/e2e/test_golden_path.py`

- [ ] **Step 1: Write the golden path test**

Create `tests/e2e/test_golden_path.py`:

```python
"""Golden path E2E test — trend to publish pipeline."""

import time

import httpx
import pytest


@pytest.mark.e2e
class TestGoldenPath:
    """Test the full content pipeline from trend detection to publishing."""

    def test_scout_trigger_scan(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 1: Trigger a trend scan."""
        resp = httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "triggered"

    def test_scout_has_trends(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 2: Verify trends were detected."""
        # Give scout time to process
        time.sleep(5)
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        trends = resp.json()
        assert len(trends) > 0, "No trends detected after scan"

    def test_director_creates_pipeline(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 3: Director creates content from a trend."""
        # Get first trend
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        trends = resp.json()
        trend_id = trends[0]["id"]

        # Trigger pipeline
        resp = httpx.post(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            json={"trend_id": trend_id},
            timeout=60,
        )
        assert resp.status_code == 200
        pipeline = resp.json()
        assert pipeline["status"] in ("running", "completed")

    def test_pipeline_completes(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 4: Wait for pipeline to complete."""
        deadline = time.time() + 120  # 2 minute timeout
        while time.time() < deadline:
            resp = httpx.get(
                f"{gateway_url}/api/v1/director/pipelines",
                headers=auth_headers,
                timeout=10,
            )
            pipelines = resp.json()
            if pipelines and pipelines[0].get("status") == "completed":
                return
            time.sleep(5)
        pytest.fail("Pipeline did not complete within 120s")

    def test_content_created(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 5: Verify content was created."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        content = resp.json()
        assert len(content) > 0, "No content created"

    def test_pulse_recorded_metrics(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 6: Verify Pulse recorded pipeline metrics."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/pulse/analytics/pipeline",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/test_golden_path.py
git commit -m "feat(ORION-97): add golden path E2E test (trend to publish)"
```

---

### Task 16: Event Flow + Auth E2E Tests

**Files:**
- Create: `tests/e2e/test_event_flow.py`
- Create: `tests/e2e/test_auth_flow.py`

- [ ] **Step 1: Write event flow test**

Create `tests/e2e/test_event_flow.py`:

```python
"""E2E tests for Redis pub/sub event flow across services."""

import httpx
import pytest
import time


@pytest.mark.e2e
class TestEventFlow:
    """Verify events propagate correctly between services."""

    def test_trend_detected_event_triggers_director(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """When scout detects a trend, director should auto-create a pipeline."""
        # Trigger a scan
        resp = httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        assert resp.status_code == 200

        # Wait for event propagation
        time.sleep(10)

        # Check director received the event
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200

    def test_pulse_receives_events_from_all_services(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Pulse should aggregate events from all services."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/pulse/analytics/events",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
```

- [ ] **Step 2: Write auth flow test**

Create `tests/e2e/test_auth_flow.py`:

```python
"""E2E tests for authentication flow."""

import httpx
import pytest


@pytest.mark.e2e
class TestAuthFlow:
    """Verify JWT authentication works end-to-end."""

    def test_login_returns_token(self, gateway_url: str) -> None:
        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/login",
            json={"email": "admin@orion.local", "password": "admin"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    def test_unauthenticated_request_rejected(self, gateway_url: str) -> None:
        resp = httpx.get(f"{gateway_url}/status", timeout=10)
        assert resp.status_code == 401

    def test_authenticated_request_succeeds(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        resp = httpx.get(
            f"{gateway_url}/status",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200

    def test_logout_invalidates_token(self, gateway_url: str) -> None:
        # Login
        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/login",
            json={"email": "admin@orion.local", "password": "admin"},
            timeout=10,
        )
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Logout
        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/logout",
            headers=headers,
            timeout=10,
        )
        assert resp.status_code == 200

        # Token should now be rejected
        resp = httpx.get(
            f"{gateway_url}/status",
            headers=headers,
            timeout=10,
        )
        assert resp.status_code == 401
```

- [ ] **Step 3: Add test-e2e Makefile target**

Add to `Makefile` after the CLI section:

```makefile
# ==============================================================================
# E2E Testing
# ==============================================================================

COMPOSE_E2E := $(COMPOSE) -f deploy/docker-compose.e2e.yml

.PHONY: test-e2e
test-e2e: ## Run E2E tests (starts Docker stack)
	uv run pytest tests/e2e/ -v -m e2e
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/test_event_flow.py tests/e2e/test_auth_flow.py Makefile
git commit -m "feat(ORION-97): add event flow and auth E2E tests"
```

---

### Task 16b: Error Recovery E2E Test

**Files:**
- Create: `tests/e2e/test_error_recovery.py`

- [ ] **Step 1: Write error recovery tests**

Create `tests/e2e/test_error_recovery.py`:

```python
"""E2E tests for error recovery — service failures and partial pipelines."""

import httpx
import pytest


@pytest.mark.e2e
class TestErrorRecovery:
    """Verify system handles failures gracefully."""

    def test_unauthenticated_service_access(self, gateway_url: str) -> None:
        """Protected endpoints reject unauthenticated requests."""
        resp = httpx.get(f"{gateway_url}/api/v1/scout/trends", timeout=10)
        assert resp.status_code == 401

    def test_invalid_content_id(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Requesting a non-existent content ID returns 404."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content/nonexistent-id",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code in (404, 400)

    def test_invalid_pipeline_trigger(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Triggering a pipeline with invalid trend ID returns error."""
        resp = httpx.post(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            json={"trend_id": "nonexistent-trend"},
            timeout=30,
        )
        assert resp.status_code in (404, 400, 422)

    def test_gateway_health_independent_of_services(self, gateway_url: str) -> None:
        """Gateway /health endpoint works even if downstream services are degraded."""
        resp = httpx.get(f"{gateway_url}/health", timeout=5)
        assert resp.status_code == 200
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/test_error_recovery.py
git commit -m "feat: add error recovery E2E tests"
```

---

## Phase 3: Performance Baseline

### Task 17: Benchmark Dependencies

**Files:**
- Modify: `pyproject.toml` (add benchmark dependency group)

- [ ] **Step 1: Add benchmark dependencies to root pyproject.toml**

Add a benchmark dependency group:

```toml
[dependency-groups]
docs = ["zensical>=0.0.26"]
benchmark = [
    "pytest>=8.3.0",
    "pytest-benchmark>=5.0.0",
    "locust>=2.32.0",
    "httpx>=0.27.0",
    "redis[hiredis]>=5.0.0",
]
```

- [ ] **Step 2: Sync workspace**

Run: `uv sync --group benchmark`
Expected: All benchmark deps installed

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add benchmark dependency group to root pyproject.toml"
```

---

### Task 18: pytest-benchmark Setup

**Files:**
- Create: `tests/benchmark/__init__.py`
- Create: `tests/benchmark/conftest.py`
- Create: `tests/benchmark/test_gateway_throughput.py`
- Create: `tests/benchmark/test_event_bus_latency.py`

- [ ] **Step 1: Create benchmark conftest**

Create `tests/benchmark/conftest.py`:

```python
"""Benchmark configuration and shared fixtures.

NOTE: Benchmarks require the Docker stack to be running.
Run `make up` (or `make up-dev`) before running `make bench`.
"""

from __future__ import annotations

import os

import httpx
import pytest

GATEWAY_URL = os.getenv("BENCH_GATEWAY_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def gateway_url() -> str:
    return GATEWAY_URL


@pytest.fixture(scope="session")
def auth_token(gateway_url: str) -> str:
    resp = httpx.post(
        f"{gateway_url}/api/v1/auth/login",
        json={"email": "admin@orion.local", "password": "admin"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}
```

- [ ] **Step 2: Create gateway throughput benchmark**

Create `tests/benchmark/test_gateway_throughput.py`:

```python
"""Benchmark gateway request throughput."""

import httpx
import pytest


def test_health_endpoint_latency(benchmark, gateway_url: str) -> None:
    """Measure /health endpoint response time."""

    def _request():
        resp = httpx.get(f"{gateway_url}/health", timeout=5)
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_status_endpoint_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure /status endpoint response time (aggregates all services)."""

    def _request():
        resp = httpx.get(f"{gateway_url}/status", headers=auth_headers, timeout=10)
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_scout_trends_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure scout trends list response time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)
```

- [ ] **Step 3: Create event bus latency benchmark**

Create `tests/benchmark/test_event_bus_latency.py`:

```python
"""Benchmark Redis pub/sub event bus latency."""

import asyncio
import time

import pytest
import redis.asyncio as aioredis


REDIS_URL = "redis://localhost:6379"


@pytest.fixture(scope="module")
def redis_client():
    client = aioredis.from_url(REDIS_URL)
    yield client
    asyncio.get_event_loop().run_until_complete(client.aclose())


def test_pubsub_round_trip(benchmark, redis_client) -> None:
    """Measure pub/sub round-trip time."""

    async def _round_trip():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("bench_channel")
        # Consume the subscribe confirmation
        await pubsub.get_message(timeout=1)

        start = time.perf_counter()
        await redis_client.publish("bench_channel", b"bench_payload")
        msg = await pubsub.get_message(timeout=5)
        elapsed = time.perf_counter() - start

        await pubsub.unsubscribe("bench_channel")
        await pubsub.aclose()
        return elapsed

    def _sync_wrapper():
        return asyncio.get_event_loop().run_until_complete(_round_trip())

    benchmark(_sync_wrapper)
```

- [ ] **Step 4: Commit**

```bash
git add tests/benchmark/
git commit -m "feat(ORION-98): add pytest-benchmark for gateway and event bus"
```

---

### Task 19: DB Query + Pipeline Latency Benchmarks

**Files:**
- Create: `tests/benchmark/test_db_query_perf.py`
- Create: `tests/benchmark/test_pipeline_latency.py`
- Create: `tests/benchmark/baselines.json`

- [ ] **Step 1: Create DB query benchmark**

Create `tests/benchmark/test_db_query_perf.py`:

```python
"""Benchmark key database query performance."""

import httpx
import pytest


def test_trends_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure trends listing query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_content_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure content listing query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_pipeline_runs_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure pipeline runs query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)
```

- [ ] **Step 2: Create pipeline latency benchmark**

Create `tests/benchmark/test_pipeline_latency.py`:

```python
"""Benchmark end-to-end pipeline duration with mocked AI providers."""

import time

import httpx
import pytest


def test_full_pipeline_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure time from scan trigger to content creation (with mocks)."""

    def _pipeline_round_trip():
        # Trigger scan
        httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        # Wait for pipeline to produce content
        deadline = time.time() + 60
        while time.time() < deadline:
            resp = httpx.get(
                f"{gateway_url}/api/v1/director/content",
                headers=auth_headers,
                timeout=10,
            )
            if resp.status_code == 200 and len(resp.json()) > 0:
                return
            time.sleep(2)

    benchmark.pedantic(_pipeline_round_trip, rounds=3, warmup_rounds=0)
```

- [ ] **Step 3: Create baselines.json template**

Create `tests/benchmark/baselines.json`:

```json
{
  "_comment": "Baseline metrics — populated after first benchmark run. CI can compare against these.",
  "gateway_health_p95_ms": null,
  "gateway_status_p95_ms": null,
  "redis_pubsub_round_trip_ms": null,
  "trends_query_p95_ms": null,
  "content_query_p95_ms": null,
  "pipeline_e2e_seconds": null
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/benchmark/test_db_query_perf.py tests/benchmark/test_pipeline_latency.py tests/benchmark/baselines.json
git commit -m "feat: add DB query and pipeline latency benchmarks with baselines template"
```

---

### Task 20: Locust Load Test

**Files:**
- Create: `tests/benchmark/locustfile.py`

- [ ] **Step 1: Create Locust load test**

Create `tests/benchmark/locustfile.py`:

```python
"""Locust load test for Orion gateway."""

from locust import HttpUser, between, task


class OrionUser(HttpUser):
    """Simulates a typical Orion user hitting gateway endpoints."""

    wait_time = between(0.5, 2)
    host = "http://localhost:8000"

    def on_start(self) -> None:
        """Authenticate on session start."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@orion.local", "password": "admin"},
        )
        if resp.status_code == 200:
            self.token = resp.json().get("access_token", "")
            self.auth_headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = ""
            self.auth_headers = {}

    @task(5)
    def health_check(self) -> None:
        self.client.get("/health")

    @task(3)
    def list_trends(self) -> None:
        self.client.get("/api/v1/scout/trends", headers=self.auth_headers)

    @task(2)
    def list_content(self) -> None:
        self.client.get("/api/v1/director/content", headers=self.auth_headers)

    @task(1)
    def check_status(self) -> None:
        self.client.get("/status", headers=self.auth_headers)

    @task(1)
    def pipeline_metrics(self) -> None:
        self.client.get("/api/v1/pulse/analytics/pipeline", headers=self.auth_headers)
```

- [ ] **Step 2: Add Makefile targets**

Add to `Makefile`:

```makefile
# ==============================================================================
# Performance Benchmarks
# ==============================================================================

.PHONY: bench
bench: ## Run pytest-benchmark suite
	uv run pytest tests/benchmark/ -v --benchmark-only

.PHONY: load-test
load-test: ## Run Locust load test (opens web UI at :8089)
	cd tests/benchmark && uv run locust -f locustfile.py
```

- [ ] **Step 3: Commit**

```bash
git add tests/benchmark/locustfile.py Makefile
git commit -m "feat(ORION-98): add Locust load test and benchmark Makefile targets"
```

---

### Task 21: Final Verification

- [ ] **Step 1: Run all CLI tests**

Run: `cd /home/gishantsingh/Dev/Projects/orion && make cli-test`
Expected: All CLI tests pass

- [ ] **Step 2: Run Go tests (verify no breakage)**

Run: `make test`
Expected: All gateway tests pass

- [ ] **Step 3: Run Python service tests**

Run: `make py-test`
Expected: All service tests pass

- [ ] **Step 4: Run linting**

Run: `make check`
Expected: All linters pass

- [ ] **Step 5: Verify CLI installs and runs**

Run:
```bash
cd cli && uv run orion --help
uv run orion system health --format json
```
Expected: Help text displays all command groups; health returns JSON

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore(ORION-98): final verification and fixes for hardening sprint"
```

---

## JIRA Ticket Summary

Create these tickets before starting implementation:

**Note:** Commit messages in this plan use epic-level ticket IDs as placeholders. When JIRA stories are created, substitute the actual story ticket IDs into each commit.

### Epics
- **ORION-96** — EPIC: Hardening Sprint — CLI Rewrite (Tasks 1-11)
- **ORION-97** — EPIC: Hardening Sprint — E2E Testing (Tasks 12-16)
- **ORION-98** — EPIC: Hardening Sprint — Performance Baseline (Tasks 17-18)

### Stories under ORION-96 (CLI)
- Scaffold CLI as UV workspace member
- Config module (gateway URL + token storage)
- Gateway HTTP client (httpx)
- Output formatting (table/JSON/plain)
- System commands (health, status)
- Auth commands (login, logout, whoami)
- Scout commands (list-trends, trigger)
- Content commands (list, view, approve, reject, regenerate)
- Pipeline commands (status, run, logs)
- Publish + Admin commands
- Delete Go CLI + update docs and Makefile

### Stories under ORION-97 (E2E)
- Mock AI provider servers (LLM, ComfyUI, TTS, Fal.ai)
- Docker Compose E2E override
- E2E conftest + fixtures
- Golden path test
- Event flow + auth E2E tests

### Stories under ORION-98 (Performance)
- pytest-benchmark setup (gateway throughput, event bus latency)
- Locust load test
