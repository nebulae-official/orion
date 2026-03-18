"""E2E test configuration — Docker Compose lifecycle and shared fixtures."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

import httpx
import pytest

COMPOSE_FILES = [
    "deploy/docker-compose.yml",
    "deploy/docker-compose.e2e.yml",
]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
GATEWAY_URL = os.getenv("E2E_GATEWAY_URL", "http://localhost:8000")
HEALTH_TIMEOUT = int(os.getenv("E2E_HEALTH_TIMEOUT", "60"))

SERVICES_TO_CHECK = [
    f"{GATEWAY_URL}/health",
    f"{GATEWAY_URL}/api/v1/scout/health",
    f"{GATEWAY_URL}/api/v1/director/health",
    f"{GATEWAY_URL}/api/v1/media/health",
    f"{GATEWAY_URL}/api/v1/editor/health",
    f"{GATEWAY_URL}/api/v1/pulse/health",
    f"{GATEWAY_URL}/api/v1/publisher/health",
]


def _compose_cmd(*args: str) -> list[str]:
    cmd = ["docker", "compose"]
    for f in COMPOSE_FILES:
        cmd.extend(["-f", str(PROJECT_ROOT / f)])
    cmd.extend(args)
    return cmd


def _wait_for_services() -> None:
    """Poll health endpoints until all services are ready."""
    deadline = time.time() + HEALTH_TIMEOUT
    pending = set(SERVICES_TO_CHECK)

    while pending and time.time() < deadline:
        for url in list(pending):
            try:
                resp = httpx.get(url, timeout=3)
                if resp.status_code == 200:
                    pending.discard(url)
            except (httpx.ConnectError, httpx.ReadTimeout):
                pass
        if pending:
            time.sleep(2)

    if pending:
        raise RuntimeError(f"Services not ready after {HEALTH_TIMEOUT}s: {pending}")


@pytest.fixture(scope="session", autouse=True)
def docker_stack():
    """Start Docker Compose stack for the test session."""
    subprocess.run(_compose_cmd("up", "-d", "--build", "--wait"), check=True, cwd=PROJECT_ROOT)
    _wait_for_services()
    yield
    subprocess.run(_compose_cmd("down", "-v"), check=True, cwd=PROJECT_ROOT)


@pytest.fixture(scope="session")
def gateway_url() -> str:
    return GATEWAY_URL


@pytest.fixture(scope="session")
def auth_token(gateway_url: str) -> str:
    """Authenticate and return a JWT token for the test session."""
    resp = httpx.post(
        f"{gateway_url}/api/v1/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture()
def truncate_db(gateway_url: str, auth_headers: dict[str, str]) -> None:
    """Truncate test data between tests. Runs before each test."""
    pass


@pytest.fixture()
def sample_trend() -> dict:
    fixtures_dir = Path(__file__).parent / "fixtures"
    with open(fixtures_dir / "sample_trend.json") as f:
        return json.load(f)
