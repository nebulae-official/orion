"""Scout commands — trend scanning and management."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.commands import get_client
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command("list-trends")
def list_trends(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """List detected trends."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/scout/trends"))
    items = data.get("items", data) if isinstance(data, dict) else data
    print_output(items, fmt=fmt, title="Trends")


@app.command()
def trigger(
    niche: Annotated[str, typer.Option(help="Niche to scan")] = "tech",
    limit: Annotated[int, typer.Option(help="Max trends to return")] = 20,
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Trigger an immediate trend scan."""
    client = get_client(token)
    data = asyncio.run(
        client.post(
            "/api/v1/scout/trends/scan",
            json={"niche": niche, "limit": limit, "region": "US"},
        )
    )
    print_output(data, fmt=fmt)


@app.command()
def configure(
    niche: Annotated[str, typer.Argument(help="Niche to activate (tech, gaming, finance)")],
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Configure the active niche for trend scanning."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/scout/trends/config"))
    print_output(data, fmt=fmt)
