"""Scout CLI integration tests with Rich SVG screenshot capture.

These tests run actual Scout API calls against a live Scout service
and capture the Rich terminal output as SVG files for documentation.

All tests in this module are automatically marked as integration tests.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from rich.console import Console
from rich.syntax import Syntax
from rich.table import Table

from .conftest import SCOUT_URL, export_svg, requires_scout

# Mark the entire module as integration — no per-test decorator needed
pytestmark = [pytest.mark.integration, requires_scout]


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────


def _scout_get(path: str) -> dict | list:
    """GET request directly to Scout service."""
    resp = httpx.get(f"{SCOUT_URL}{path}", timeout=10)
    resp.raise_for_status()
    return resp.json()


def _scout_post(path: str, **kwargs) -> dict:
    """POST request directly to Scout service."""
    resp = httpx.post(f"{SCOUT_URL}{path}", timeout=30, **kwargs)
    resp.raise_for_status()
    return resp.json()


def _render_table(data: list[dict], console: Console, title: str | None = None) -> None:
    """Render a list of dicts as a Rich table to a recording console."""
    if not data:
        console.print("[dim]No results.[/dim]")
        return
    table = Table(title=title, show_lines=False)
    keys = list(data[0].keys())
    for key in keys:
        table.add_column(key.replace("_", " ").title(), style="cyan", no_wrap=(key == "id"))
    for row in data:
        table.add_row(*(str(row.get(k, ""))[:80] for k in keys))
    console.print(table)


def _render_json(data: dict | list, console: Console) -> None:
    """Render JSON output with syntax highlighting."""
    formatted = json.dumps(data, indent=2, default=str)
    syntax = Syntax(formatted, "json", theme="monokai", line_numbers=False)
    console.print(syntax)


def _make_console() -> Console:
    """Create a recording Console for SVG export."""
    return Console(record=True, width=120, force_terminal=True)


def _print_command(console: Console, cmd: str) -> None:
    """Print a simulated command prompt line."""
    console.print()
    console.print(f"[bold green]$[/bold green] [white]{cmd}[/white]")
    console.print()


# ─────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────


class TestScoutListTrends:
    """Integration tests for `orion scout list-trends`."""

    def test_list_trends_table(self, svg_dir: Path) -> None:
        """Verify list-trends returns real data and capture table SVG."""
        data = _scout_get("/api/v1/trends")

        items = data.get("items", data) if isinstance(data, dict) else data
        assert len(items) > 0, "Expected at least one trend from live Scout"

        # Verify trend structure
        first = items[0]
        assert "topic" in first
        assert "source" in first

        # Render for SVG — show first 8 trends with selected columns
        display_items = []
        for t in items[:8]:
            display_items.append(
                {
                    "topic": t["topic"][:60],
                    "source": t.get("source", "").split(":")[-1][:25],
                    "score": t.get("score", ""),
                    "status": t.get("status", ""),
                }
            )

        console = _make_console()
        _print_command(console, "orion scout list-trends")
        _render_table(display_items, console, title="Detected Trends")

        path = export_svg(console, "scout-list-trends.svg", title="orion scout list-trends")
        assert path.exists()
        assert path.stat().st_size > 1000  # SVG should be non-trivial

    def test_list_trends_json(self, svg_dir: Path) -> None:
        """Capture JSON output format as SVG."""
        data = _scout_get("/api/v1/trends")
        items = data.get("items", data) if isinstance(data, dict) else data

        # Show first 2 trends in JSON
        console = _make_console()
        _print_command(console, "orion scout list-trends --format json")
        _render_json(items[:2], console)

        path = export_svg(
            console, "scout-list-trends-json.svg", title="orion scout list-trends --format json"
        )
        assert path.exists()


class TestScoutTrigger:
    """Integration tests for `orion scout trigger`."""

    def test_trigger_scan(self, svg_dir: Path) -> None:
        """Trigger a real scan and capture SVG output."""
        data = _scout_post(
            "/api/v1/trends/scan",
            json={"region": "US", "limit": 5, "niche": "tech"},
        )

        assert "trends_found" in data or "message" in data

        console = _make_console()
        _print_command(console, "orion scout trigger")
        _render_table([data], console, title="Scan Result")

        path = export_svg(console, "scout-trigger.svg", title="orion scout trigger")
        assert path.exists()


class TestScoutConfigure:
    """Integration tests for `orion scout configure`."""

    def test_configure_niche(self, svg_dir: Path) -> None:
        """Show current niche configuration and capture SVG output."""
        data = _scout_get("/api/v1/trends/config")

        # Flatten for table display
        display = {
            "active_niche": data.get("active_niche", ""),
            "available_niches": ", ".join(data.get("available_niches", [])),
            "min_score": data.get("config", {}).get("min_score", ""),
        }

        console = _make_console()
        _print_command(console, "orion scout configure tech")
        _render_table([display], console, title="Scout Configuration")

        path = export_svg(console, "scout-configure.svg", title="orion scout configure tech")
        assert path.exists()
