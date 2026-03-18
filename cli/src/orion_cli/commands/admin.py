"""Admin commands — seed, cleanup."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional

import typer

from orion_cli.commands import get_client

app = typer.Typer()


@app.command()
def seed(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
) -> None:
    """Seed the database with sample data."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/seed"))
    typer.echo(f"Seed complete: {data}")


@app.command()
def cleanup(
    token: Annotated[Optional[str], typer.Option(help="JWT token")] = None,
    days: Annotated[int, typer.Option(help="Delete data older than N days")] = 90,
) -> None:
    """Run data cleanup."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/cleanup", json={"days": days}))
    typer.echo(f"Cleanup complete: {data}")
