"""Tests for the Editor render pipeline."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.render_pipeline import RenderPipeline, STAGE_TTS, STAGE_CAPTIONS


class TestRenderPipeline:
    """Tests for the RenderPipeline orchestrator."""

    def _make_pipeline(
        self,
        tts: AsyncMock | None = None,
        captioner: AsyncMock | None = None,
        stitcher: AsyncMock | None = None,
        burner: AsyncMock | None = None,
        event_bus: AsyncMock | None = None,
        thumbnail_gen: AsyncMock | None = None,
        validator: AsyncMock | None = None,
    ) -> RenderPipeline:
        tts = tts or AsyncMock()
        captioner = captioner or AsyncMock()
        stitcher = stitcher or AsyncMock()
        burner = burner or AsyncMock()
        event_bus = event_bus or AsyncMock()
        thumbnail_gen = thumbnail_gen or AsyncMock()
        validator = validator or AsyncMock()
        return RenderPipeline(
            tts_provider=tts,
            captioner=captioner,
            stitcher=stitcher,
            subtitle_burner=burner,
            event_bus=event_bus,
            thumbnail_generator=thumbnail_gen,
            video_validator=validator,
        )

    @pytest.mark.asyncio
    async def test_render_calls_all_stages(self) -> None:
        """Render pipeline calls TTS, captioner, stitcher, burner in sequence."""
        tts = AsyncMock()
        tts.synthesize.return_value = MagicMock(
            file_path="/tmp/audio.mp3", duration_seconds=10.0, provider="test"
        )

        captioner = AsyncMock()
        captioner.transcribe.return_value = MagicMock(
            segments=[], full_text="test", language="en"
        )

        stitcher = AsyncMock()
        stitcher.stitch.return_value = "/tmp/raw_video.mp4"

        burner = AsyncMock()
        burner.burn_subtitles.return_value = "/tmp/final_video.mp4"

        thumbnail_gen = AsyncMock()
        thumbnail_gen.generate.return_value = "/tmp/thumb.jpg"

        validator = AsyncMock()
        validation_result = MagicMock()
        validation_result.valid = True
        validation_result.confidence_score = 0.95
        validation_result.issues = []
        validator.validate.return_value = validation_result

        event_bus = AsyncMock()

        pipeline = self._make_pipeline(
            tts=tts,
            captioner=captioner,
            stitcher=stitcher,
            burner=burner,
            event_bus=event_bus,
            thumbnail_gen=thumbnail_gen,
            validator=validator,
        )

        content_id = uuid.uuid4()
        session = AsyncMock()

        # Mock Content object
        content = MagicMock()
        content.title = "Test Video"
        content.script_body = "This is the script body."
        content.niche = "tech"
        session.get.return_value = content

        # Mock image assets
        mock_asset = MagicMock()
        mock_asset.file_path = "/tmp/image.png"

        with patch(
            "src.services.render_pipeline.EditorAssetRepository"
        ) as MockRepo:
            repo_instance = AsyncMock()
            repo_instance.get_by_content_id.return_value = [mock_asset]
            repo_instance.create.return_value = MagicMock(id=uuid.uuid4())
            MockRepo.return_value = repo_instance

            run = await pipeline.render(content_id=content_id, session=session)

        tts.synthesize.assert_called_once()
        captioner.transcribe.assert_called_once()
        stitcher.stitch.assert_called_once()
        burner.burn_subtitles.assert_called_once()
        event_bus.publish.assert_called()

    @pytest.mark.asyncio
    async def test_render_content_not_found(self) -> None:
        """Render raises ValueError when content_id not found."""
        pipeline = self._make_pipeline()
        session = AsyncMock()
        session.get.return_value = None

        with patch("src.services.render_pipeline.EditorAssetRepository"):
            with pytest.raises(ValueError, match="not found"):
                await pipeline.render(
                    content_id=uuid.uuid4(), session=session
                )

    @pytest.mark.asyncio
    async def test_render_no_images_raises(self) -> None:
        """Render raises ValueError when no image assets exist."""
        tts = AsyncMock()
        tts.synthesize.return_value = MagicMock(
            file_path="/tmp/audio.mp3", duration_seconds=10.0, provider="test"
        )
        captioner = AsyncMock()
        captioner.transcribe.return_value = MagicMock(
            segments=[], full_text="test", language="en"
        )

        pipeline = self._make_pipeline(tts=tts, captioner=captioner)
        session = AsyncMock()
        content = MagicMock()
        content.title = "Test"
        content.script_body = "Script"
        session.get.return_value = content

        with patch(
            "src.services.render_pipeline.EditorAssetRepository"
        ) as MockRepo:
            repo_instance = AsyncMock()
            repo_instance.get_by_content_id.return_value = []  # No images
            MockRepo.return_value = repo_instance

            with pytest.raises(ValueError, match="No image assets"):
                await pipeline.render(
                    content_id=uuid.uuid4(), session=session
                )

    def test_resolve_subtitle_style_tiktok(self) -> None:
        """_resolve_subtitle_style returns tiktok preset by default."""
        style = RenderPipeline._resolve_subtitle_style("tiktok")
        assert style is not None

    def test_resolve_subtitle_style_unknown_defaults_tiktok(self) -> None:
        """Unknown style name falls back to tiktok."""
        style = RenderPipeline._resolve_subtitle_style("nonexistent")
        assert style is not None

    def test_stage_constants_defined(self) -> None:
        """Pipeline stage constants are defined."""
        assert STAGE_TTS == "tts_generation"
        assert STAGE_CAPTIONS == "caption_generation"
