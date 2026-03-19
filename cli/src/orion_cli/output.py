"""Output formatting — table, JSON, and plain text modes."""

from __future__ import annotations

import json
from enum import StrEnum
from io import StringIO
from typing import Any

from rich.console import Console
from rich.table import Table


class OutputFormat(StrEnum):
    TABLE = "table"
    JSON = "json"
    PLAIN = "plain"


def format_output(
    data: list[dict[str, Any]] | dict[str, Any],
    fmt: OutputFormat = OutputFormat.TABLE,
    title: str | None = None,
) -> str:
    """Format data for display. Returns a string."""
    if fmt == OutputFormat.JSON:
        return json.dumps(data, indent=2, default=str)

    if isinstance(data, dict):
        data = [data]

    if not data:
        return "No results."

    if fmt == OutputFormat.PLAIN:
        lines: list[str] = []
        for row in data:
            lines.append("\t".join(str(v) for v in row.values()))
        return "\n".join(lines)

    # TABLE format using Rich
    table = Table(title=title)
    keys = list(data[0].keys())
    for key in keys:
        table.add_column(key.replace("_", " ").title())
    for row in data:
        table.add_row(*(str(row.get(k, "")) for k in keys))

    buf = StringIO()
    console = Console(file=buf, force_terminal=False, width=120)
    console.print(table)
    return buf.getvalue()


def print_output(
    data: list[dict[str, Any]] | dict[str, Any],
    fmt: OutputFormat = OutputFormat.TABLE,
    title: str | None = None,
) -> None:
    """Format and print data to stdout."""
    output = format_output(data, fmt=fmt, title=title)
    if fmt == OutputFormat.TABLE:
        Console().print(output, end="")
    else:
        print(output)
