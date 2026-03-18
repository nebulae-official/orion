"""Benchmark configuration and shared fixtures.

NOTE: Benchmarks require the Docker stack to be running.
Run `make up` (or `make up-dev`) before running `make bench`.
"""

from __future__ import annotations

import os

import httpx
import pytest

GATEWAY_URL = os.getenv("BENCH_GATEWAY_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def gateway_url() -> str:
    return GATEWAY_URL


@pytest.fixture(scope="session")
def auth_token(gateway_url: str) -> str:
    resp = httpx.post(
        f"{gateway_url}/api/v1/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}
