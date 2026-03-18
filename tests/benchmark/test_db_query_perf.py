"""Benchmark key database query performance."""

import httpx
import pytest


def test_trends_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure trends listing query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/scout/trends",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_content_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure content listing query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/content",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)


def test_pipeline_runs_query_latency(
    benchmark, gateway_url: str, auth_headers: dict[str, str]
) -> None:
    """Measure pipeline runs query time."""

    def _request():
        resp = httpx.get(
            f"{gateway_url}/api/v1/director/pipelines",
            headers=auth_headers,
            timeout=10,
        )
        assert resp.status_code == 200
        return resp

    benchmark(_request)
