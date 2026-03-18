"""Auth commands — login, logout, whoami."""

from __future__ import annotations

import asyncio
from typing import Annotated

import typer

from orion_cli.client import GatewayClient
from orion_cli.config import CLIConfig

app = typer.Typer()


@app.command()
def login(
    username: Annotated[str, typer.Option(prompt=True)],
    password: Annotated[str, typer.Option(prompt=True, hide_input=True)],
) -> None:
    """Authenticate with the gateway and store token."""
    cfg = CLIConfig()
    client = GatewayClient(base_url=cfg.gateway_url)
    data = asyncio.run(client.login(username=username, password=password))
    token = data["access_token"]
    cfg.save_token(token)
    typer.echo(f"Logged in successfully. Token: {token[:12]}...")


@app.command()
def logout() -> None:
    """Revoke token and clear stored credentials."""
    cfg = CLIConfig()
    if cfg.token:
        client = GatewayClient(base_url=cfg.gateway_url, token=cfg.token)
        try:
            asyncio.run(client.post("/api/v1/auth/logout"))
        except SystemExit:
            pass
    cfg.clear_token()
    typer.echo("Logged out.")


@app.command()
def whoami() -> None:
    """Show current authentication status."""
    cfg = CLIConfig()
    if cfg.token:
        typer.echo(f"Authenticated. Token: {cfg.token[:12]}...")
    else:
        typer.echo("Not logged in. Run 'orion auth login' to authenticate.")
