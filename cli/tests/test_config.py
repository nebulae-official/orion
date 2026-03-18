"""Tests for CLI configuration management."""

import tomli_w
import pytest
from pathlib import Path


def test_default_config(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig
    cfg = CLIConfig(config_dir=tmp_path)
    assert cfg.gateway_url == "http://localhost:8000"
    assert cfg.token is None


def test_save_and_load_token(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig
    cfg = CLIConfig(config_dir=tmp_path)
    cfg.save_token("test-jwt-token-123")
    reloaded = CLIConfig(config_dir=tmp_path)
    assert reloaded.token == "test-jwt-token-123"


def test_clear_token(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig
    cfg = CLIConfig(config_dir=tmp_path)
    cfg.save_token("test-jwt-token-123")
    cfg.clear_token()
    reloaded = CLIConfig(config_dir=tmp_path)
    assert reloaded.token is None


def test_custom_gateway_url(tmp_path: Path) -> None:
    from orion_cli.config import CLIConfig
    config_file = tmp_path / "config.toml"
    config_file.write_bytes(
        tomli_w.dumps({"gateway_url": "http://orion.example.com:8000"}).encode()
    )
    cfg = CLIConfig(config_dir=tmp_path)
    assert cfg.gateway_url == "http://orion.example.com:8000"
