"""Benchmark end-to-end pipeline duration with mocked AI providers."""

import time

import httpx
import pytest


def test_full_pipeline_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure time from scan trigger to content creation (with mocks)."""

    def _pipeline_round_trip():
        httpx.post(
            f"{gateway_url}/api/v1/scout/scan",
            headers=auth_headers,
            timeout=30,
        )
        deadline = time.time() + 60
        while time.time() < deadline:
            resp = httpx.get(
                f"{gateway_url}/api/v1/director/content",
                headers=auth_headers,
                timeout=10,
            )
            if resp.status_code == 200 and len(resp.json()) > 0:
                return
            time.sleep(2)

    benchmark.pedantic(_pipeline_round_trip, rounds=3, warmup_rounds=0)
