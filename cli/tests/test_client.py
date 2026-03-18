"""Tests for the gateway HTTP client."""

import httpx
import pytest
import respx

from orion_cli.client import GatewayClient


@respx.mock
@pytest.mark.asyncio
async def test_health_check() -> None:
    respx.get("http://localhost:8000/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "version": "dev"})
    )
    client = GatewayClient(base_url="http://localhost:8000")
    result = await client.health()
    assert result["status"] == "ok"


@respx.mock
@pytest.mark.asyncio
async def test_login() -> None:
    respx.post("http://localhost:8000/api/v1/auth/login").mock(
        return_value=httpx.Response(200, json={"access_token": "jwt-123", "token_type": "bearer"})
    )
    client = GatewayClient(base_url="http://localhost:8000")
    result = await client.login(username="admin", password="secret")
    assert result["access_token"] == "jwt-123"


@respx.mock
@pytest.mark.asyncio
async def test_authenticated_request() -> None:
    respx.get("http://localhost:8000/status").mock(
        return_value=httpx.Response(200, json={"services": {}})
    )
    client = GatewayClient(base_url="http://localhost:8000", token="jwt-123")
    result = await client.get("/status")
    assert "services" in result
    assert respx.calls[0].request.headers["Authorization"] == "Bearer jwt-123"


@respx.mock
@pytest.mark.asyncio
async def test_connection_error() -> None:
    respx.get("http://localhost:8000/health").mock(side_effect=httpx.ConnectError("refused"))
    client = GatewayClient(base_url="http://localhost:8000")
    with pytest.raises(SystemExit) as exc_info:
        await client.health()
    assert exc_info.value.code == 3
