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
