"""Editor service integration tests (D1-D2).

D1 exercises the ProviderServiceTTSClient directly via respx — it mocks the
provider service HTTP endpoint and verifies the client decodes audio_b64,
writes a WAV file, and computes duration_seconds.

D2 exercises the full TTS route path through FastAPI, verifying the JSON
response structure returned by the endpoint.
"""

from __future__ import annotations

import base64
import io
import wave

import httpx
import pytest
import pytest_asyncio
import respx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from src.providers.base import TTSProvider, TTSRequest, TTSResult
from src.providers.provider_client import ProviderServiceTTSClient
from src.routes.render import router as render_router
from src.routes.render import set_components

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _minimal_wav(duration_secs: float = 1.0, sample_rate: int = 22050) -> bytes:
    """Create a minimal valid WAV file in memory."""
    n_frames = int(duration_secs * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_frames)
    return buf.getvalue()


class FakeTTSProvider(TTSProvider):
    async def synthesize(self, request: TTSRequest) -> TTSResult:
        return TTSResult(
            file_path="/tmp/integration_tts.mp3",
            duration_seconds=12.5,
            provider="fake_tts",
        )

    async def list_voices(self) -> list[dict]:
        return [{"id": "default", "name": "Default"}]

    async def is_available(self) -> bool:
        return True


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def editor_app() -> FastAPI:
    app = FastAPI(title="Editor Integration Test")
    app.include_router(render_router)
    set_components(FakeTTSProvider(), None)  # type: ignore[arg-type]
    return app


@pytest_asyncio.fixture
async def client(editor_app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=editor_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# D1: ProviderServiceTTSClient decodes audio_b64 and computes duration
# ---------------------------------------------------------------------------


@respx.mock
async def test_d1_provider_service_tts_client_decodes_and_saves(tmp_path) -> None:
    """ProviderServiceTTSClient calls provider service, decodes WAV, returns duration."""
    wav_bytes = _minimal_wav(duration_secs=1.0)
    audio_b64 = base64.b64encode(wav_bytes).decode()

    respx.post("http://provider:8008/api/v1/tts/speak").mock(
        return_value=httpx.Response(
            200,
            json={"audio_b64": audio_b64, "provider": "nvidia_nim/magpie"},
        )
    )

    tts_client = ProviderServiceTTSClient(output_dir=str(tmp_path))
    result = await tts_client.synthesize(
        TTSRequest(text="Hello from the integration test", voice_id="default")
    )

    assert result.duration_seconds > 0.0
    assert result.provider == "nvidia_nim/magpie"
    from pathlib import Path

    assert Path(result.file_path).exists()
    assert Path(result.file_path).stat().st_size > 0


# ---------------------------------------------------------------------------
# D2: POST /api/v1/editor/tts returns correct JSON shape
# ---------------------------------------------------------------------------


async def test_d2_tts_endpoint_returns_file_path_and_duration(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/editor/tts",
        json={"text": "Integration test speech", "voice_id": "default"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "file_path" in data
    assert "duration_seconds" in data
    assert "provider" in data
    assert isinstance(data["duration_seconds"], float)
    assert data["duration_seconds"] > 0
