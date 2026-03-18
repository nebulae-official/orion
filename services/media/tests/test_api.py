"""Tests for Media service API endpoints."""

from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest

requires_db = pytest.mark.skipif(
    os.getenv("DATABASE_URL") is None,
    reason="Requires running database",
)
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_providers(client: AsyncClient) -> None:
    """GET /api/v1/media/providers returns provider status."""
    resp = await client.get("/api/v1/media/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert len(data["providers"]) >= 1
    assert data["providers"][0]["available"] is True


@pytest.mark.asyncio
async def test_generate_image_success(client: AsyncClient) -> None:
    """POST /api/v1/media/generate creates an image without content_id."""
    with patch("src.routes.images.get_session") as mock_session:
        mock_session.return_value = AsyncMock()
        resp = await client.post(
            "/api/v1/media/generate",
            json={"prompt": "A futuristic city at sunset"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "fake"
    assert data["width"] == 1024
    assert data["height"] == 1024
    assert "file_path" in data


@pytest.mark.asyncio
async def test_generate_image_custom_dimensions(client: AsyncClient) -> None:
    """POST /api/v1/media/generate respects custom width/height."""
    with patch("src.routes.images.get_session") as mock_session:
        mock_session.return_value = AsyncMock()
        resp = await client.post(
            "/api/v1/media/generate",
            json={
                "prompt": "Test",
                "width": 512,
                "height": 768,
                "steps": 30,
                "cfg_scale": 8.5,
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["width"] == 512
    assert data["height"] == 768


@pytest.mark.asyncio
async def test_generate_image_missing_prompt(client: AsyncClient) -> None:
    """POST /api/v1/media/generate without prompt returns 422."""
    resp = await client.post("/api/v1/media/generate", json={})
    assert resp.status_code == 422


@requires_db
@pytest.mark.asyncio
async def test_get_assets_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/media/assets/{content_id} needs DB session."""
    content_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/media/assets/{content_id}")
    # Will fail without DB dependency override
    assert resp.status_code in (500, 422)


@pytest.mark.asyncio
async def test_batch_generate_requires_content_id(client: AsyncClient) -> None:
    """POST /api/v1/media/batch requires content_id and prompts."""
    resp = await client.post("/api/v1/media/batch", json={})
    assert resp.status_code == 422
