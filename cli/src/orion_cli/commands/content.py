"""Content commands — list, view, approve, reject, regenerate."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command("list")
def list_content(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List all content items."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/director/content"))
    print_output(data, fmt=fmt, title="Content")


@app.command()
def view(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """View a specific content item."""
    client = get_client(token)
    data = asyncio.run(client.get(f"/api/v1/director/content/{content_id}"))
    print_output(data, fmt=fmt)


@app.command()
def approve(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Approve a content item for publishing."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/approve"))
    print_output(data, fmt=fmt)


@app.command()
def reject(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Reject a content item."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/reject"))
    print_output(data, fmt=fmt)


@app.command()
def regenerate(
    content_id: str,
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Regenerate a content item with feedback."""
    client = get_client(token)
    data = asyncio.run(client.post(f"/api/v1/director/content/{content_id}/regenerate"))
    print_output(data, fmt=fmt)
