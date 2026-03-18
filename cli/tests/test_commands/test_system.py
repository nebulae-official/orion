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
