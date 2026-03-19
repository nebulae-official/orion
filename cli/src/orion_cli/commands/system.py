"""System commands — health, status, providers."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command()
def health(
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Check gateway health."""
    client = get_client()
    data = asyncio.run(client.health())
    print_output(data, fmt=fmt)


@app.command()
def status(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show status of all services."""
    client = get_client(token)
    data = asyncio.run(client.get("/status"))
    services = data.get("services", {})
    rows = [
        {
            "name": name,
            "status": info.get("status", "unknown"),
            "latency_ms": info.get("latency_ms", ""),
        }
        for name, info in services.items()
    ]
    print_output(rows, fmt=fmt, title="Service Status")
