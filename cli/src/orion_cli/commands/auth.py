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
    email: Annotated[str, typer.Option(prompt=True)],
    password: Annotated[str, typer.Option(prompt=True, hide_input=True)],
) -> None:
    """Authenticate with the gateway and store token."""
    cfg = CLIConfig()
    client = GatewayClient(base_url=cfg.gateway_url)
    data = asyncio.run(client.login(email=email, password=password))
    token = data["access_token"]
    cfg.save_token(token)
    user = data.get("user", {})
    user_email = user.get("email")
    if user_email:
        typer.echo(f"Logged in as {user_email}.")
    else:
        typer.echo("Logged in successfully.")


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
    if not cfg.token:
        typer.echo("Not logged in. Run 'orion auth login' to authenticate.")
        return
    client = GatewayClient(base_url=cfg.gateway_url, token=cfg.token)
    try:
        profile = asyncio.run(client.whoami())
        name = profile.get("name", "")
        email = profile.get("email", "")
        role = profile.get("role", "")
        parts = []
        if name:
            parts.append(name)
        if email:
            parts.append(f"<{email}>")
        if role:
            parts.append(f"({role})")
        typer.echo(f"Logged in as {' '.join(parts)}")
    except SystemExit:
        typer.echo("Authenticated, but could not fetch profile.")
