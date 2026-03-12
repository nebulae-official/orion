"""Integration tests for Orion service health checks.

These tests require a running Docker Compose environment.
Run with: docker compose -f deploy/docker-compose.yml up -d && pytest tests/integration/

Configure the gateway URL via ORION_GATEWAY_URL (default: http://localhost:8000).
"""

from __future__ import annotations

import os

import httpx
import pytest

GATEWAY_URL = os.getenv("ORION_GATEWAY_URL", "http://localhost:8000")

# Direct service URLs (used when testing without gateway proxy)
SERVICE_URLS = {
    "gateway": GATEWAY_URL,
    "scout": os.getenv("ORION_SCOUT_URL", "http://localhost:8001"),
    "director": os.getenv("ORION_DIRECTOR_URL", "http://localhost:8002"),
    "media": os.getenv("ORION_MEDIA_URL", "http://localhost:8003"),
    "editor": os.getenv("ORION_EDITOR_URL", "http://localhost:8004"),
    "pulse": os.getenv("ORION_PULSE_URL", "http://localhost:8005"),
}


@pytest.fixture
def client() -> httpx.Client:
    return httpx.Client(timeout=10.0)


# ---------------------------------------------------------------------------
# Direct health checks — each service responds to /health
# ---------------------------------------------------------------------------


class TestServiceHealth:
    """Verify each service responds to /health."""

    @pytest.mark.integration
    def test_gateway_health(self, client: httpx.Client) -> None:
        """Gateway /health returns 200 with status ok."""
        resp = client.get(f"{SERVICE_URLS['gateway']}/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    @pytest.mark.integration
    def test_scout_health(self, client: httpx.Client) -> None:
        """Scout /health returns 200."""
        resp = client.get(f"{SERVICE_URLS['scout']}/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "scout"

    @pytest.mark.integration
    def test_director_health(self, client: httpx.Client) -> None:
        """Director /health returns 200."""
        resp = client.get(f"{SERVICE_URLS['director']}/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "director"

    @pytest.mark.integration
    def test_media_health(self, client: httpx.Client) -> None:
        """Media /health returns 200."""
        resp = client.get(f"{SERVICE_URLS['media']}/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "media"

    @pytest.mark.integration
    def test_editor_health(self, client: httpx.Client) -> None:
        """Editor /health returns 200."""
        resp = client.get(f"{SERVICE_URLS['editor']}/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "editor"

    @pytest.mark.integration
    def test_pulse_health(self, client: httpx.Client) -> None:
        """Pulse /health returns 200."""
        resp = client.get(f"{SERVICE_URLS['pulse']}/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "pulse"


# ---------------------------------------------------------------------------
# Gateway proxy tests — gateway forwards to downstream services
# ---------------------------------------------------------------------------


class TestGatewayProxy:
    """Verify the gateway proxies requests to downstream services."""

    @pytest.mark.integration
    def test_gateway_proxies_to_scout(self, client: httpx.Client) -> None:
        """Gateway proxies /api/v1/trends/config to scout."""
        resp = client.get(f"{GATEWAY_URL}/api/v1/trends/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "active_niche" in data

    @pytest.mark.integration
    def test_gateway_proxies_to_pulse_analytics(self, client: httpx.Client) -> None:
        """Gateway proxies /api/v1/analytics/metrics to pulse."""
        resp = client.get(f"{GATEWAY_URL}/api/v1/analytics/metrics")
        assert resp.status_code == 200

    @pytest.mark.integration
    def test_gateway_proxies_to_media_providers(self, client: httpx.Client) -> None:
        """Gateway proxies /api/v1/media/providers to media."""
        resp = client.get(f"{GATEWAY_URL}/api/v1/media/providers")
        assert resp.status_code == 200
        assert "providers" in resp.json()

    @pytest.mark.integration
    def test_gateway_returns_404_for_unknown_routes(self, client: httpx.Client) -> None:
        """Gateway returns 404 for unregistered routes."""
        resp = client.get(f"{GATEWAY_URL}/api/v1/nonexistent")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Redis pub/sub connectivity (basic check via readiness endpoints)
# ---------------------------------------------------------------------------


class TestRedisConnectivity:
    """Verify services can reach Redis (via /ready endpoints)."""

    @pytest.mark.integration
    def test_scout_ready(self, client: httpx.Client) -> None:
        """Scout /ready includes redis check."""
        resp = client.get(f"{SERVICE_URLS['scout']}/ready")
        assert resp.status_code == 200
        data = resp.json()
        if "checks" in data and "redis" in data["checks"]:
            assert data["checks"]["redis"] is True

    @pytest.mark.integration
    def test_pulse_ready(self, client: httpx.Client) -> None:
        """Pulse /ready includes redis and postgres checks."""
        resp = client.get(f"{SERVICE_URLS['pulse']}/ready")
        assert resp.status_code == 200
        data = resp.json()
        if "checks" in data:
            for check_name, check_ok in data["checks"].items():
                assert check_ok is True, f"{check_name} check failed"

    @pytest.mark.integration
    def test_editor_ready(self, client: httpx.Client) -> None:
        """Editor /ready includes redis and postgres checks."""
        resp = client.get(f"{SERVICE_URLS['editor']}/ready")
        assert resp.status_code == 200
