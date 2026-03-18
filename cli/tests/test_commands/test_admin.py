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
