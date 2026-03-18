"""Golden path E2E test — trend to publish pipeline."""

import time

import httpx
import pytest


@pytest.mark.e2e
class TestGoldenPath:
    """Test the full content pipeline from trend detection to publishing."""

    def test_scout_trigger_scan(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 1: Trigger a trend scan."""
        resp = httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "triggered"

    def test_scout_has_trends(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 2: Verify trends were detected."""
        time.sleep(5)
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        trends = resp.json()
        assert len(trends) > 0, "No trends detected after scan"

    def test_director_creates_pipeline(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 3: Director creates content from a trend."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        trends = resp.json()
        trend_id = trends[0]["id"]

        resp = httpx.post(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            json={"trend_id": trend_id},
            timeout=60,
        )
        assert resp.status_code == 200
        pipeline = resp.json()
        assert pipeline["status"] in ("running", "completed")

    def test_pipeline_completes(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 4: Wait for pipeline to complete."""
        deadline = time.time() + 120
        while time.time() < deadline:
            resp = httpx.get(
                f"{gateway_url}/api/v1/director/pipelines",
                headers=auth_headers,
                timeout=10,
            )
            pipelines = resp.json()
            if pipelines and pipelines[0].get("status") == "completed":
                return
            time.sleep(5)
        pytest.fail("Pipeline did not complete within 120s")

    def test_content_created(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 5: Verify content was created."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        content = resp.json()
        assert len(content) > 0, "No content created"

    def test_pulse_recorded_metrics(
        self, gateway_url: str, auth_headers: dict[str, str]
    ) -> None:
        """Step 6: Verify Pulse recorded pipeline metrics."""
        resp = httpx.get(
            f"{gateway_url}/api/v1/pulse/analytics/pipeline",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
