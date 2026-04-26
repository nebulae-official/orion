"""Integration test configuration.

All tests in this directory are marked as integration tests automatically
via the module-level pytestmark. They require live services (scout, etc.)
and are skipped when the Scout service is not reachable.

For SVG capture, tests hit services directly (not through the gateway)
to avoid auth complexity in integration tests.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx
import pytest
from rich.console import Console

SCOUT_URL = os.environ.get("ORION_SCOUT_URL", "http://localhost:8001")
SVG_OUTPUT_DIR = Path(__file__).parent / "svg_output"
DOCS_ASSETS_DIR = Path(__file__).parents[3] / "docs" / "assets" / "cli"


def _scout_reachable() -> bool:
    """Check if the Scout service is reachable."""
    try:
        resp = httpx.get(f"{SCOUT_URL}/health", timeout=3)
        return resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


requires_scout = pytest.mark.skipif(
    not _scout_reachable(),
    reason=f"Scout not reachable at {SCOUT_URL}",
)


@pytest.fixture(scope="session")
def scout_url() -> str:
    """Return the Scout service URL for integration tests."""
    return SCOUT_URL


@pytest.fixture(scope="session")
def svg_dir() -> Path:
    """Return the SVG output directory, ensuring it exists."""
    SVG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return SVG_OUTPUT_DIR


@pytest.fixture(scope="session")
def docs_assets_dir() -> Path:
    """Return the docs assets directory for CLI screenshots."""
    DOCS_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    return DOCS_ASSETS_DIR


def export_svg(console: Console, filename: str, title: str | None = None) -> Path:
    """Export the recorded console output as an SVG file.

    Saves to both the test svg_output/ dir and docs/assets/cli/ for documentation.

    Args:
        console: A Rich Console with record=True that has captured output.
        filename: Name of the SVG file (e.g., 'scout-list-trends.svg').
        title: Window title shown in the SVG terminal chrome.

    Returns:
        Path to the generated SVG file in svg_output/.
    """
    SVG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    svg_content = console.export_svg(title=title or filename.replace(".svg", ""))

    # Save to test output
    test_path = SVG_OUTPUT_DIR / filename
    test_path.write_text(svg_content)

    # Also save to docs assets for documentation
    docs_path = DOCS_ASSETS_DIR / filename
    docs_path.write_text(svg_content)

    return test_path
