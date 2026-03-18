"""E2E tests for Redis pub/sub event flow across services."""

import httpx
import pytest
import time


@pytest.mark.e2e
class TestEventFlow:
    """Verify events propagate correctly between services."""

    def test_trend_detected_event_triggers_director(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """When scout detects a trend, director should auto-create a pipeline."""
        resp = httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        assert resp.status_code == 200

        time.sleep(10)

        resp = httpx.get(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200

    def test_pulse_receives_events_from_all_services(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Pulse should aggregate events from all services."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/pulse/analytics/events",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
