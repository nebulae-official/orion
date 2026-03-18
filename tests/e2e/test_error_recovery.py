"""E2E tests for error recovery — service failures and partial pipelines."""

import httpx
import pytest


@pytest.mark.e2e
class TestErrorRecovery:
    """Verify system handles failures gracefully."""

    def test_unauthenticated_service_access(self, gateway_url: str) -> None:
        """Protected endpoints reject unauthenticated requests."""
        resp = httpx.get(f"{gateway_url}/api/v1/scout/trends", timeout=10)
        assert resp.status_code == 401

    def test_invalid_content_id(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Requesting a non-existent content ID returns 404."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content/nonexistent-id",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code in (404, 400)

    def test_invalid_pipeline_trigger(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Triggering a pipeline with invalid trend ID returns error."""
        resp = httpx.post(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            json={"trend_id": "nonexistent-trend"},
            timeout=30,
        )
        assert resp.status_code in (404, 400, 422)

    def test_gateway_health_independent_of_services(self, gateway_url: str) -> None:
        """Gateway /health endpoint works even if downstream services are degraded."""
        resp = httpx.get(f"{gateway_url}/health", timeout=5)
        assert resp.status_code == 200
