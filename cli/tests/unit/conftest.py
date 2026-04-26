"""CLI test configuration."""

from pathlib import Path

import pytest


@pytest.fixture
def config_dir(tmp_path: Path) -> Path:
    """Provide a temporary config directory for tests."""
    return tmp_path / ".orion"
