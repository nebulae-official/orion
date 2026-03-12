"""Tests for TTS provider abstractions and schemas."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.providers.base import TTSProvider, TTSRequest, TTSResult
from src.schemas import (
    CaptionRequest,
    CaptionResponse,
    CaptionSegmentSchema,
    RenderRequest,
    RenderResponse,
    TTSGenerateRequest,
    TTSGenerateResponse,
)


class TestTTSRequest:
    """Tests for TTSRequest model."""

    def test_defaults(self) -> None:
        req = TTSRequest(text="Hello world")
        assert req.voice_id == "default"
        assert req.speed == 1.0
        assert req.output_format == "mp3"

    def test_custom_values(self) -> None:
        req = TTSRequest(
            text="Custom",
            voice_id="narrator",
            speed=1.5,
            output_format="wav",
        )
        assert req.voice_id == "narrator"
        assert req.speed == 1.5
        assert req.output_format == "wav"


class TestTTSResult:
    """Tests for TTSResult model."""

    def test_creation(self) -> None:
        result = TTSResult(
            file_path="/tmp/output.mp3",
            duration_seconds=12.5,
            provider="elevenlabs",
        )
        assert result.file_path == "/tmp/output.mp3"
        assert result.duration_seconds == 12.5
        assert result.provider == "elevenlabs"


class TestEditorSchemas:
    """Tests for Editor Pydantic request/response schemas."""

    def test_render_request_defaults(self) -> None:
        import uuid

        req = RenderRequest(content_id=uuid.uuid4())
        assert req.voice_id == "default"
        assert req.subtitle_style == "tiktok"
        assert req.video_width == 1080
        assert req.video_height == 1920

    def test_tts_generate_request_defaults(self) -> None:
        req = TTSGenerateRequest(text="test")
        assert req.voice_id == "default"
        assert req.speed == 1.0
        assert req.output_format == "mp3"

    def test_caption_request_defaults(self) -> None:
        req = CaptionRequest(audio_path="/tmp/audio.mp3")
        assert req.language == "en"

    def test_caption_response_model(self) -> None:
        resp = CaptionResponse(
            segments=[
                CaptionSegmentSchema(start=0.0, end=2.5, text="Hello"),
                CaptionSegmentSchema(start=2.5, end=5.0, text="World"),
            ],
            full_text="Hello World",
            language="en",
            srt="1\n00:00:00,000 --> 00:00:02,500\nHello\n",
        )
        assert len(resp.segments) == 2
        assert resp.full_text == "Hello World"

    def test_render_response_model(self) -> None:
        import uuid

        resp = RenderResponse(
            content_id=uuid.uuid4(),
            status="completed",
            pipeline_run_id=uuid.uuid4(),
            video_path="/tmp/final.mp4",
            message="Done",
        )
        assert resp.status == "completed"
        assert resp.message == "Done"
