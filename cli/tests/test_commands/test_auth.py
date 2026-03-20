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
        return_value=httpx.Response(
            200,
            json={
                "access_token": "jwt-new",
                "token_type": "bearer",
                "user": {"id": "u1", "email": "admin@orion.dev", "name": "Admin", "role": "admin"},
            },
        )
    )
    result = runner.invoke(
        app, ["auth", "login", "--email", "admin@orion.dev", "--password", "secret"]
    )
    assert result.exit_code == 0
    assert "Logged in as admin@orion.dev" in result.stdout
    # Token must NOT appear in output
    assert "jwt-new" not in result.stdout


@respx.mock
def test_login_command_no_user_field(tmp_path, monkeypatch) -> None:
    """Login response without user object falls back to generic message."""
    monkeypatch.setenv("HOME", str(tmp_path))
    respx.post("http://localhost:8000/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={"access_token": "jwt-new", "token_type": "bearer"})
    )
    result = runner.invoke(
        app, ["auth", "login", "--email", "admin@orion.dev", "--password", "secret"]
    )
    assert result.exit_code == 0
    assert "Logged in successfully." in result.stdout
    assert "jwt-new" not in result.stdout


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


@respx.mock
def test_whoami_with_profile(tmp_path, monkeypatch) -> None:
    """whoami calls /api/v1/identity/users/me and shows user info."""
    monkeypatch.setenv("HOME", str(tmp_path))
    token_dir = tmp_path / ".orion"
    token_dir.mkdir()
    (token_dir / "token").write_text("jwt-valid")

    respx.get("http://localhost:8000/api/v1/identity/users/me").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "u1",
                "email": "admin@orion.dev",
                "name": "Admin User",
                "role": "admin",
                "timezone": "UTC",
                "email_verified": True,
                "is_active": True,
                "created_at": "2025-01-01T00:00:00",
            },
        )
    )
    result = runner.invoke(app, ["auth", "whoami"])
    assert result.exit_code == 0
    assert "Admin User" in result.stdout
    assert "admin@orion.dev" in result.stdout
    assert "admin" in result.stdout
    # Token must NOT appear in output
    assert "jwt-valid" not in result.stdout


@respx.mock
def test_whoami_profile_unavailable(tmp_path, monkeypatch) -> None:
    """whoami falls back gracefully when the profile endpoint is unreachable."""
    monkeypatch.setenv("HOME", str(tmp_path))
    token_dir = tmp_path / ".orion"
    token_dir.mkdir()
    (token_dir / "token").write_text("jwt-valid")

    respx.get("http://localhost:8000/api/v1/identity/users/me").mock(
        side_effect=httpx.ConnectError("refused")
    )
    result = runner.invoke(app, ["auth", "whoami"])
    assert result.exit_code == 0
    assert "could not fetch profile" in result.stdout
