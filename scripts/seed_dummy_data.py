#!/usr/bin/env python3
"""Seed dummy data into Orion via the Gateway API.

Loads fixture JSON files from scripts/fixtures/ and POSTs them to the
running Gateway. Requires the full Docker stack to be up.

Usage:
    python scripts/seed_dummy_data.py
    python scripts/seed_dummy_data.py --gateway-url http://localhost:8000
    python scripts/seed_dummy_data.py --reset
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    print("httpx is required: pip install httpx")
    sys.exit(1)

GATEWAY_URL = "http://localhost:8000"
FIXTURES_DIR = Path(__file__).parent / "fixtures"

FIXTURE_ENDPOINT_MAP = {
    "trends": "/api/v1/scout/trends",
    "content": "/api/v1/content",
    "media_assets": "/api/v1/media/assets",
    "pipeline_runs": "/api/v1/pulse/pipeline/runs",
    "costs": "/api/v1/pulse/costs",
    "publishing_history": "/api/v1/publisher/publish/history",
}


def load_fixture(name: str) -> list[dict]:
    """Load a JSON fixture file and return the data."""
    path = FIXTURES_DIR / f"{name}.json"
    if not path.exists():
        print(f"  [SKIP] {name}: fixture file not found at {path}")
        return []
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        return [data]
    return data


def seed_fixture(
    client: httpx.Client,
    name: str,
    endpoint: str,
    count: int | None = None,
) -> int:
    """POST each item in a fixture to the corresponding API endpoint."""
    items = load_fixture(name)
    if count is not None:
        items = items[:count]

    seeded = 0
    for item in items:
        try:
            response = client.post(endpoint, json=item)
            if response.status_code in (200, 201):
                seeded += 1
            else:
                print(f"  [WARN] {name}: {response.status_code} — {response.text[:120]}")
        except httpx.RequestError as exc:
            print(f"  [ERROR] {name}: {exc}")
            break
    return seeded


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Orion with dummy data")
    parser.add_argument(
        "--gateway-url",
        default=GATEWAY_URL,
        help=f"Gateway base URL (default: {GATEWAY_URL})",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="JWT token for authenticated endpoints",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear existing data first (via POST /api/v1/pulse/admin/cleanup)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=None,
        help="Override max items per fixture",
    )
    args = parser.parse_args()

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    client = httpx.Client(base_url=args.gateway_url, headers=headers, timeout=30)

    # Check gateway connectivity
    try:
        resp = client.get("/health")
        if resp.status_code != 200:
            print(f"Gateway at {args.gateway_url} returned {resp.status_code}")
            sys.exit(1)
        print(f"Connected to gateway at {args.gateway_url}")
    except httpx.RequestError:
        print(f"Cannot reach gateway at {args.gateway_url}")
        print("Is the Docker stack running? Try: make up")
        sys.exit(1)

    if args.reset:
        print("Resetting existing data...")
        try:
            resp = client.post("/api/v1/pulse/admin/cleanup", json={"days": 0})
            print(f"  Reset: {resp.status_code}")
        except httpx.RequestError as exc:
            print(f"  Reset failed: {exc}")

    print("\nSeeding fixtures...")
    for name, endpoint in FIXTURE_ENDPOINT_MAP.items():
        count = seed_fixture(client, name, endpoint, args.count)
        print(f"  {name}: {count} items seeded")

    print("\nSeeding complete!")
    print("View in dashboard: http://localhost:3001")


if __name__ == "__main__":
    main()
