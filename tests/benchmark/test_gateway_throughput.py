"""Benchmark gateway request throughput."""

import httpx
import pytest


def test_health_endpoint_latency(benchmark, gateway_url: str) -> None:
    """Measure /health endpoint response time."""

    def _request():
        resp = httpx.get(f"{gateway_url}/health", timeout=5)
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_status_endpoint_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure /status endpoint response time (aggregates all services)."""

    def _request():
        resp = httpx.get(f"{gateway_url}/status", headers=auth_headers, timeout=10)
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_scout_trends_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure scout trends list response time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)
