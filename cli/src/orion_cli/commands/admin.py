"""Admin commands — seed, cleanup, seed-demo."""

from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Annotated

import typer

from orion_cli.commands import get_client

app = typer.Typer()


@app.command()
def seed(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Seed the database with sample data."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/seed"))
    typer.echo(f"Seed complete: {data}")


@app.command()
def cleanup(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    days: Annotated[int, typer.Option(help="Delete data older than N days")] = 90,
) -> None:
    """Run data cleanup."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/pulse/admin/cleanup", json={"days": days}))
    typer.echo(f"Cleanup complete: {data}")


@app.command("seed-demo")
def seed_demo() -> None:
    """Generate dummy data fixtures for demo purposes."""
    # Find the generate script relative to the project root
    script = Path(__file__).resolve().parents[4] / "scripts" / "generate_dummy_data.py"
    if not script.exists():
        typer.echo(f"Generator script not found at {script}", err=True)
        raise typer.Exit(1)

    typer.echo("Generating demo fixtures...")
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        typer.echo(f"Error: {result.stderr}", err=True)
        raise typer.Exit(1)

    typer.echo(result.stdout)
    typer.echo("Start dashboard with: NEXT_PUBLIC_DEMO_MODE=true make dash-dev")
