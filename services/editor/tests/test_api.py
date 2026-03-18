"""Tests for Editor service API endpoints."""

from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

requires_db = pytest.mark.skipif(
    os.getenv("DATABASE_URL") is None,
    reason="Requires running database",
)
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tts_generate_success(client: AsyncClient) -> None:
    """POST /api/v1/editor/tts generates audio from text."""
    resp = await client.post(
        "/api/v1/editor/tts",
        json={"text": "Hello, this is a test.", "voice_id": "default"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "fake_tts"
    assert data["duration_seconds"] == 15.5
    assert "file_path" in data


@pytest.mark.asyncio
async def test_tts_generate_custom_params(client: AsyncClient) -> None:
    """POST /api/v1/editor/tts with custom speed and format."""
    resp = await client.post(
        "/api/v1/editor/tts",
        json={
            "text": "Custom parameters test.",
            "voice_id": "narrator",
            "speed": 1.5,
            "output_format": "wav",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "file_path" in data


@pytest.mark.asyncio
async def test_tts_generate_missing_text(client: AsyncClient) -> None:
    """POST /api/v1/editor/tts without text returns 422."""
    resp = await client.post("/api/v1/editor/tts", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_captions_generate(client: AsyncClient, mock_captioner: AsyncMock) -> None:
    """POST /api/v1/editor/captions generates captions from audio."""
    mock_result = MagicMock()
    mock_result.segments = [
        MagicMock(start=0.0, end=2.5, text="Hello world"),
        MagicMock(start=2.5, end=5.0, text="This is a test"),
    ]
    mock_result.full_text = "Hello world This is a test"
    mock_result.language = "en"
    mock_captioner.transcribe.return_value = mock_result

    with patch("src.routes.render.to_srt", return_value="1\n00:00:00,000 --> 00:00:02,500\nHello world\n"):
        resp = await client.post(
            "/api/v1/editor/captions",
            json={"audio_path": "/tmp/test_audio.mp3", "language": "en"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["segments"]) == 2
    assert data["language"] == "en"
    assert data["full_text"] == "Hello world This is a test"


@pytest.mark.asyncio
async def test_render_trigger(client: AsyncClient, mock_pipeline: AsyncMock) -> None:
    """POST /api/v1/editor/render triggers the render pipeline."""
    content_id = uuid.uuid4()
    mock_run = MagicMock()
    mock_run.status.value = "completed"
    mock_run.id = uuid.uuid4()
    mock_pipeline.render.return_value = mock_run

    with patch("src.routes.render.get_session") as mock_session:
        mock_session.return_value = AsyncMock()
        resp = await client.post(
            "/api/v1/editor/render",
            json={"content_id": str(content_id)},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"


@requires_db
@pytest.mark.asyncio
async def test_render_status_requires_db(client: AsyncClient) -> None:
    """GET /api/v1/editor/render/{id}/status needs DB."""
    content_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/editor/render/{content_id}/status")
    assert resp.status_code in (500, 422)
