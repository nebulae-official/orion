"""Pipeline commands — status, run, logs."""

from __future__ import annotations

import asyncio
import json
from typing import Annotated

import typer
import websockets

from orion_cli.commands import get_client
from orion_cli.config import CLIConfig
from orion_cli.output import OutputFormat, print_output

app = typer.Typer()


@app.command()
def status(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Show pipeline run history."""
    client = get_client(token)
    data = asyncio.run(client.get("/api/v1/director/pipelines"))
    print_output(data, fmt=fmt, title="Pipeline Runs")


@app.command()
def run(
    trend_id: str,
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
    fmt: Annotated[OutputFormat, typer.Option("--format")] = OutputFormat.TABLE,
) -> None:
    """Trigger a pipeline run for a trend."""
    client = get_client(token)
    data = asyncio.run(client.post("/api/v1/director/pipelines", json={"trend_id": trend_id}))
    print_output(data, fmt=fmt)


@app.command()
def logs(
    token: Annotated[str | None, typer.Option(help="JWT token")] = None,
) -> None:
    """Stream live pipeline events via WebSocket."""
    cfg = CLIConfig()
    tok = token or cfg.token
    ws_url = cfg.gateway_url.replace("http://", "ws://").replace("https://", "wss://")

    async def _stream() -> None:
        async with websockets.connect(f"{ws_url}/ws?token={tok}") as ws:
            typer.echo("Connected. Streaming events (Ctrl+C to stop)...")
            async for message in ws:
                data = json.loads(message)
                event_type = data.get("type", "unknown")
                typer.echo(f"[{event_type}] {json.dumps(data.get('payload', {}), indent=2)}")

    try:
        asyncio.run(_stream())
    except KeyboardInterrupt:
        typer.echo("\nDisconnected.")
