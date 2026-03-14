"""Shared fixtures for Editor service tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.providers.base import TTSProvider, TTSRequest, TTSResult
from src.routes.render import router as render_router
from src.routes.render import set_components, set_render_pipeline


class FakeTTSProvider(TTSProvider):
    """Deterministic TTS provider for testing."""

    async def synthesize(self, request: TTSRequest) -> TTSResult:
        return TTSResult(
            file_path=f"/tmp/tts_{request.voice_id}.mp3",
            duration_seconds=15.5,
            provider="fake_tts",
        )

    async def list_voices(self) -> list[dict]:
        return [
            {"id": "default", "name": "Default Voice"},
            {"id": "narrator", "name": "Narrator Voice"},
        ]

    async def is_available(self) -> bool:
        return True


@pytest.fixture
def fake_tts() -> FakeTTSProvider:
    return FakeTTSProvider()


@pytest.fixture
def mock_captioner() -> AsyncMock:
    captioner = AsyncMock()
    captioner.transcribe = AsyncMock()
    return captioner


@pytest.fixture
def mock_pipeline() -> AsyncMock:
    pipeline = AsyncMock()
    return pipeline


@pytest.fixture
def editor_app(
    fake_tts: FakeTTSProvider,
    mock_captioner: AsyncMock,
    mock_pipeline: AsyncMock,
) -> FastAPI:
    """Minimal FastAPI app with editor routes."""
    app = FastAPI(title="Editor Test")
    app.include_router(render_router)
    set_render_pipeline(mock_pipeline)
    set_components(fake_tts, mock_captioner)
    return app


@pytest.fixture
async def client(editor_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=editor_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
