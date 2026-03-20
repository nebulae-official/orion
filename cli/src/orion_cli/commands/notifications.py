"""Notification commands."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command("list")
def list_notifications(
    unread: Annotated[bool, typer.Option("--unread", help="Show only unread")] = False,
    page: Annotated[int, typer.Option(help="Page number")] = 1,
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List notifications."""
    client = get_client(token)
    params: dict[str, str | int] = {"page": page, "page_size": 20}
    if unread:
        params["unread"] = "true"
    data = asyncio.run(client.get("/api/v1/identity/notifications", params=params))
    items = data.get("items", [])
    print_output(items, fmt=fmt, title="Notifications")


@app.command("read")
def mark_read(
    notification_id: Annotated[str, typer.Argument(help="Notification ID")],
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Mark a notification as read."""
    client = get_client(token)
    asyncio.run(client.patch(f"/api/v1/identity/notifications/{notification_id}/read"))
    typer.echo("Marked as read.")


@app.command("read-all")
def mark_all_read(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Mark all notifications as read."""
    client = get_client(token)
    result = asyncio.run(client.post("/api/v1/identity/notifications/read-all"))
    typer.echo(f"Marked {result.get('marked', 0)} notifications as read.")


@app.command("count")
def unread_count(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Show unread notification count."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/identity/notifications/unread-count"))
    typer.echo(f"Unread: {data['count']}")
