"""CLI command groups."""

from orion_cli.client import GatewayClient
from orion_cli.config import CLIConfig


def get_client(token: str | None = None) -> GatewayClient:
    """Shared client factory — injected into all commands via import."""
    cfg = CLIConfig()
    return GatewayClient(base_url=cfg.gateway_url, token=token or cfg.token)
