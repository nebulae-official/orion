"""Tests for notification CLI commands."""

import httpx
import respx
from orion_cli.main import app
from typer.testing import CliRunner

runner = CliRunner()

NOTIF_BASE = "http://localhost:8000/api/v1/identity/notifications"


@respx.mock
def test_list_notifications() -> None:
    """orion notifications list displays notifications."""
    respx.get(NOTIF_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "n1",
                        "type": "trend.detected",
                        "title": "New trend detected: AI Coding",
                        "body": None,
                        "metadata": None,
                        "is_read": False,
                        "read_at": None,
                        "created_at": "2026-03-20T12:00:00Z",
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 20,
            },
        ),
    )
    result = runner.invoke(app, ["notifications", "list", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "AI Coding" in result.stdout


@respx.mock
def test_list_notifications_empty() -> None:
    """orion notifications list with no results shows No results."""
    respx.get(NOTIF_BASE).mock(
        return_value=httpx.Response(
            200,
            json={"items": [], "total": 0, "page": 1, "page_size": 20},
        ),
    )
    result = runner.invoke(app, ["notifications", "list", "--token", "jwt-123"])
    assert result.exit_code == 0
    assert "No results" in result.stdout


@respx.mock
def test_list_notifications_unread_flag() -> None:
    """orion notifications list --unread passes unread=true query param."""
    route = respx.get(NOTIF_BASE).mock(
        return_value=httpx.Response(
            200,
            json={"items": [], "total": 0, "page": 1, "page_size": 20},
        ),
    )
    result = runner.invoke(
        app, ["notifications", "list", "--unread", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    # Verify the unread param was sent
    assert "unread=true" in str(route.calls[0].request.url)


@respx.mock
def test_list_notifications_json_format() -> None:
    """orion notifications list --format json outputs JSON."""
    respx.get(NOTIF_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "n1",
                        "type": "trend.detected",
                        "title": "Trend: AI",
                        "body": None,
                        "metadata": None,
                        "is_read": False,
                        "read_at": None,
                        "created_at": "2026-03-20T12:00:00Z",
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 20,
            },
        ),
    )
    result = runner.invoke(
        app, ["notifications", "list", "--format", "json", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert '"type"' in result.stdout


@respx.mock
def test_mark_read() -> None:
    """orion notifications read marks a notification as read."""
    notif_id = "11111111-1111-1111-1111-111111111111"
    respx.patch(f"{NOTIF_BASE}/{notif_id}/read").mock(
        return_value=httpx.Response(200, json={"status": "ok"})
    )
    result = runner.invoke(
        app, ["notifications", "read", notif_id, "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert "Marked as read" in result.stdout


@respx.mock
def test_mark_all_read() -> None:
    """orion notifications read-all marks all as read."""
    respx.post(f"{NOTIF_BASE}/read-all").mock(
        return_value=httpx.Response(200, json={"status": "ok", "marked": 5})
    )
    result = runner.invoke(
        app, ["notifications", "read-all", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert "5" in result.stdout


@respx.mock
def test_mark_all_read_zero() -> None:
    """orion notifications read-all with no unread shows 0."""
    respx.post(f"{NOTIF_BASE}/read-all").mock(
        return_value=httpx.Response(200, json={"status": "ok", "marked": 0})
    )
    result = runner.invoke(
        app, ["notifications", "read-all", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert "0" in result.stdout


@respx.mock
def test_unread_count() -> None:
    """orion notifications count shows unread count."""
    respx.get(f"{NOTIF_BASE}/unread-count").mock(
        return_value=httpx.Response(200, json={"count": 12})
    )
    result = runner.invoke(
        app, ["notifications", "count", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert "12" in result.stdout


@respx.mock
def test_unread_count_zero() -> None:
    """orion notifications count shows 0 when no unread."""
    respx.get(f"{NOTIF_BASE}/unread-count").mock(
        return_value=httpx.Response(200, json={"count": 0})
    )
    result = runner.invoke(
        app, ["notifications", "count", "--token", "jwt-123"]
    )
    assert result.exit_code == 0
    assert "0" in result.stdout
