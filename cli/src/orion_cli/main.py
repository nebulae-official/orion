"""Orion CLI — main entry point."""

from __future__ import annotations

import typer

from orion_cli.commands import admin, auth, content, notifications, pipeline, publish, scout, system

app = typer.Typer(
    name="orion",
    help="Orion Digital Twin Content Agency CLI",
    no_args_is_help=True,
)

app.add_typer(system.app, name="system", help="System health, status, and configuration")
app.add_typer(auth.app, name="auth", help="Authentication (login, logout, whoami)")
app.add_typer(scout.app, name="scout", help="Trend scanning and management")
app.add_typer(content.app, name="content", help="Content pipeline management")
app.add_typer(pipeline.app, name="pipeline", help="Pipeline runs and logs")
app.add_typer(publish.app, name="publish", help="Publishing and social accounts")
app.add_typer(admin.app, name="admin", help="Admin operations (seed, cleanup)")
app.add_typer(notifications.app, name="notifications", help="Notification management")

if __name__ == "__main__":
    app()
