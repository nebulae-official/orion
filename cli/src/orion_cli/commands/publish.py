"""Publish commands — accounts, publish, history."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command()
def accounts(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List connected social media accounts."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/publisher/accounts"))
    print_output(data, fmt=fmt, title="Accounts")


@app.command()
def send(
    content_id: str,
    platform: Annotated[str, typer.Option(help="Target platform (twitter, youtube, tiktok, linkedin)")],
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Publish content to a platform."""
    client = get_client(token)
    data = asyncio.run(
        client.post(
            "/api/v1/publisher/publish",
            json={"content_id": content_id, "platform": platform},
        )
    )
    print_output(data, fmt=fmt)


@app.command()
def history(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show publishing history."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/publisher/history"))
    print_output(data, fmt=fmt, title="Publishing History")
