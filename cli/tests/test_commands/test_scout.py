"""Tests for scout commands."""

import httpx
import respx
from orion_cli.main import app
from typer.testing import CliRunner

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
        return_value=httpx.Response(
            200,
            json={"status": "triggered", "providers": ["google_trends", "rss"]},
        )
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
