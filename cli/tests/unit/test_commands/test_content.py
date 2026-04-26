"""Tests for content commands."""

import httpx
import respx
from orion_cli.main import app
from typer.testing import CliRunner

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
            200,
            json={
                "id": "c1",
                "title": "AI Tools 2026",
                "status": "approved",
                "script": "Hook: ...",
            },
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
