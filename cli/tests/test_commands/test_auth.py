"""Tests for auth commands."""

import httpx
import respx
from orion_cli.main import app
from typer.testing import CliRunner

runner = CliRunner()


@respx.mock
def test_login_command(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    respx.post("http://localhost:8000/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={"access_token": "jwt-new", "token_type": "bearer"})
    )
    result = runner.invoke(app, ["auth", "login", "--username", "admin", "--password", "secret"])
    assert result.exit_code == 0
    assert "jwt-new" in result.stdout or "Logged in" in result.stdout


@respx.mock
def test_logout_command(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
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
