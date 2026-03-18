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
