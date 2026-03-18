"""Shared fixtures for Media service tests."""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.providers.base import ImageProvider, ImageRequest, ImageResult
from src.routes.images import configure_router
from src.routes.images import router as images_router
from src.services.batch_generator import BatchGenerator


class FakeImageProvider(ImageProvider):
    """Deterministic image provider for testing."""

    def __init__(self, should_fail: bool = False) -> None:
        self._should_fail = should_fail
        self._call_count = 0

    async def generate(self, request: ImageRequest) -> ImageResult:
        self._call_count += 1
        if self._should_fail:
            raise RuntimeError("Provider unavailable")
        return ImageResult(
            file_path=f"/tmp/generated_{self._call_count}.png",
            provider="fake",
            width=request.width,
            height=request.height,
            metadata={"prompt": request.prompt},
        )

    async def is_available(self) -> bool:
        return not self._should_fail


@pytest.fixture
def fake_provider() -> FakeImageProvider:
    return FakeImageProvider()


@pytest.fixture
def failing_provider() -> FakeImageProvider:
    return FakeImageProvider(should_fail=True)


@pytest.fixture
def batch_generator(fake_provider: FakeImageProvider) -> BatchGenerator:
    return BatchGenerator(fake_provider, max_concurrent=2)


@pytest.fixture
def media_app(fake_provider: FakeImageProvider, batch_generator: BatchGenerator) -> FastAPI:
    """Minimal FastAPI app with media routes."""
    app = FastAPI(title="Media Test")
    app.include_router(images_router)
    configure_router(fake_provider, batch_generator)
    return app


@pytest_asyncio.fixture
async def client(media_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=media_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
