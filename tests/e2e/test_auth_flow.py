"""E2E tests for authentication flow."""

import httpx
import pytest


@pytest.mark.e2e
class TestAuthFlow:
    """Verify JWT authentication works end-to-end."""

    def test_login_returns_token(self, gateway_url: str) -> None:
        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/login",
            json={"username": "admin", "password": "admin"},
            timeout=10,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    def test_unauthenticated_request_rejected(self, gateway_url: str) -> None:
        resp = httpx.get(f"{gateway_url}/status", timeout=10)
        assert resp.status_code == 401

    def test_authenticated_request_succeeds(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        resp = httpx.get(
            f"{gateway_url}/status",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200

    def test_logout_invalidates_token(self, gateway_url: str) -> None:
        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/login",
            json={"username": "admin", "password": "admin"},
            timeout=10,
        )
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = httpx.post(
            f"{gateway_url}/api/v1/auth/logout",
            headers=headers,
            timeout=10,
        )
        assert resp.status_code == 200

        resp = httpx.get(
            f"{gateway_url}/status",
            headers=headers,
            timeout=10,
        )
        assert resp.status_code == 401
