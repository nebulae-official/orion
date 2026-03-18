"""CLI configuration management — gateway URL and auth token storage."""

from __future__ import annotations

from pathlib import Path

import structlog
import tomli
import tomli_w

logger = structlog.get_logger()

DEFAULT_GATEWAY_URL = "http://localhost:8000"


class CLIConfig:
    """Manages CLI configuration from ~/.orion/config.toml."""

    def __init__(self, config_dir: Path | None = None) -> None:
        if config_dir is None:
            config_dir = Path.home() / ".orion"
        self._config_dir = config_dir
        self._config_file = config_dir / "config.toml"
        self._token_file = config_dir / "token"
        self._data = self._load()

    @property
    def gateway_url(self) -> str:
        return self._data.get("gateway_url", DEFAULT_GATEWAY_URL)

    @property
    def token(self) -> str | None:
        if self._token_file.exists():
            value = self._token_file.read_text().strip()
            return value if value else None
        return None

    def save_token(self, token: str) -> None:
        self._config_dir.mkdir(parents=True, exist_ok=True)
        self._token_file.write_text(token)
        self._token_file.chmod(0o600)
        logger.debug("token_saved", path=str(self._token_file))

    def clear_token(self) -> None:
        if self._token_file.exists():
            self._token_file.unlink()
            logger.debug("token_cleared")

    def _load(self) -> dict:
        if not self._config_file.exists():
            return {}
        with open(self._config_file, "rb") as f:
            return tomli.load(f)
