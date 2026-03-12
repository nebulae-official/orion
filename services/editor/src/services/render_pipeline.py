"""Full render pipeline: TTS -> captions -> stitch -> subtitles -> publish."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import (
    AssetType,
    Content,
    ContentStatus,
    PipelineRun,
    PipelineStatus,
)
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from ..captions.whisper_stt import WhisperCaptioner
from ..providers.base import TTSProvider, TTSRequest
from ..repositories.asset_repo import EditorAssetRepository
from ..video.stitcher import StitchRequest, VideoConfig, VideoStitcher
from ..video.subtitles import SubtitleBurner, SubtitleStyle
from ..video.thumbnails import ThumbnailGenerator
from ..video.validator import VideoValidator

logger = structlog.get_logger(__name__)

# Pipeline stage names
STAGE_TTS = "tts_generation"
STAGE_CAPTIONS = "caption_generation"
STAGE_STITCH = "video_stitching"
STAGE_SUBTITLES = "subtitle_burning"
STAGE_THUMBNAILS = "thumbnail_generation"
STAGE_VALIDATION = "video_validation"
STAGE_PUBLISH = "publish"


class RenderPipeline:
    """Orchestrate the full video rendering flow.

    Stages:
    1. Generate TTS audio from the content script
    2. Transcribe the audio to get word-level captions
    3. Stitch images + audio into a slideshow video
    4. Burn karaoke-style subtitles onto the video
    5. Save the final video as a MediaAsset
    6. Publish a CONTENT_UPDATED event with status ``review``
    """

    def __init__(
        self,
        tts_provider: TTSProvider,
        captioner: WhisperCaptioner,
        stitcher: VideoStitcher,
        subtitle_burner: SubtitleBurner,
        event_bus: EventBus,
        thumbnail_generator: ThumbnailGenerator | None = None,
        video_validator: VideoValidator | None = None,
    ) -> None:
        self._tts = tts_provider
        self._captioner = captioner
        self._stitcher = stitcher
        self._burner = subtitle_burner
        self._event_bus = event_bus
        self._thumbnail_gen = thumbnail_generator or ThumbnailGenerator()
        self._validator = video_validator or VideoValidator()

    async def render(
        self,
        content_id: uuid.UUID,
        session: AsyncSession,
        voice_id: str = "default",
        subtitle_style: str = "tiktok",
        video_width: int = 1080,
        video_height: int = 1920,
    ) -> PipelineRun:
        """Execute the full render pipeline for *content_id*.

        Returns the ``PipelineRun`` record tracking the overall pipeline.
        """
        repo = EditorAssetRepository(session)

        # Fetch the content record
        content = await session.get(Content, content_id)
        if content is None:
            raise ValueError(f"Content {content_id} not found")

        # Create a top-level pipeline run
        pipeline_run = PipelineRun(
            content_id=content_id,
            stage="render_pipeline",
            status=PipelineStatus.running,
            started_at=datetime.now(timezone.utc),
        )
        session.add(pipeline_run)
        await session.flush()

        try:
            # --- Stage 1: TTS Generation ---
            await self._set_stage(session, pipeline_run, STAGE_TTS)

            script_text = content.script_body or content.title
            tts_result = await self._tts.synthesize(
                TTSRequest(text=script_text, voice_id=voice_id)
            )

            await repo.create(
                content_id=content_id,
                asset_type=AssetType.audio,
                provider=tts_result.provider,
                file_path=tts_result.file_path,
                metadata={"duration_seconds": tts_result.duration_seconds},
            )

            # --- Stage 2: Caption Generation ---
            await self._set_stage(session, pipeline_run, STAGE_CAPTIONS)

            caption_result = await self._captioner.transcribe(
                tts_result.file_path
            )

            # --- Stage 3: Video Stitching ---
            await self._set_stage(session, pipeline_run, STAGE_STITCH)

            image_assets = await repo.get_by_content_id(
                content_id, asset_type=AssetType.image
            )
            if not image_assets:
                raise ValueError(
                    f"No image assets found for content {content_id}"
                )

            image_paths = [a.file_path for a in image_assets]
            video_config = VideoConfig(
                width=video_width,
                height=video_height,
            )

            raw_video_path = await self._stitcher.stitch(
                StitchRequest(
                    image_paths=image_paths,
                    audio_path=tts_result.file_path,
                    config=video_config,
                )
            )

            # --- Stage 4: Subtitle Burning ---
            await self._set_stage(session, pipeline_run, STAGE_SUBTITLES)

            style = self._resolve_subtitle_style(subtitle_style)
            final_video_path = await self._burner.burn_subtitles(
                video_path=raw_video_path,
                caption_result=caption_result,
                style=style,
            )

            # --- Stage 5: Thumbnail Generation ---
            await self._set_stage(session, pipeline_run, STAGE_THUMBNAILS)

            title = content.title or "Untitled"
            niche = getattr(content, "niche", "default") or "default"

            thumbnail_paths: list[str] = []
            for platform in ("youtube", "reels", "tiktok"):
                thumb_path = await self._thumbnail_gen.generate(
                    video_path=final_video_path,
                    title=title,
                    platform=platform,
                    niche=niche,
                )
                thumbnail_paths.append(thumb_path)

                await repo.create(
                    content_id=content_id,
                    asset_type=AssetType.image,
                    provider="editor",
                    file_path=thumb_path,
                    metadata={
                        "type": "thumbnail",
                        "platform": platform,
                    },
                )

            # --- Stage 6: Video Quality Validation ---
            await self._set_stage(session, pipeline_run, STAGE_VALIDATION)

            validation_result = await self._validator.validate(final_video_path)

            if not validation_result.valid:
                await logger.awarning(
                    "video_validation_issues",
                    content_id=str(content_id),
                    confidence_score=validation_result.confidence_score,
                    issues=[
                        i.model_dump()
                        for i in validation_result.issues
                        if not i.passed
                    ],
                )

            # --- Stage 7: Save & Publish ---
            await self._set_stage(session, pipeline_run, STAGE_PUBLISH)

            await repo.create(
                content_id=content_id,
                asset_type=AssetType.video,
                provider="editor",
                file_path=final_video_path,
                metadata={
                    "subtitle_style": subtitle_style,
                    "resolution": f"{video_width}x{video_height}",
                    "validation_score": validation_result.confidence_score,
                    "validation_passed": validation_result.valid,
                },
            )

            # Update content status to review
            await session.execute(
                update(Content)
                .where(Content.id == content_id)
                .values(status=ContentStatus.review)
            )

            # Mark pipeline as completed
            pipeline_run.status = PipelineStatus.completed
            pipeline_run.completed_at = datetime.now(timezone.utc)
            await session.commit()

            # Publish event
            await self._event_bus.publish(
                Channels.CONTENT_UPDATED,
                {
                    "content_id": str(content_id),
                    "status": "review",
                    "video_path": final_video_path,
                    "pipeline_run_id": str(pipeline_run.id),
                    "thumbnail_paths": thumbnail_paths,
                    "validation_score": validation_result.confidence_score,
                    "validation_passed": validation_result.valid,
                },
            )

            await logger.ainfo(
                "render_pipeline_completed",
                content_id=str(content_id),
                video_path=final_video_path,
                validation_score=validation_result.confidence_score,
            )

        except Exception as exc:
            pipeline_run.status = PipelineStatus.failed
            pipeline_run.error_message = str(exc)[:2000]
            pipeline_run.completed_at = datetime.now(timezone.utc)
            await session.commit()

            await self._event_bus.publish(
                Channels.MEDIA_FAILED,
                {
                    "content_id": str(content_id),
                    "error": str(exc)[:500],
                    "pipeline_run_id": str(pipeline_run.id),
                },
            )

            await logger.aexception(
                "render_pipeline_failed",
                content_id=str(content_id),
            )
            raise

        return pipeline_run

    @staticmethod
    async def _set_stage(
        session: AsyncSession, run: PipelineRun, stage: str
    ) -> None:
        """Update the current stage on the pipeline run record."""
        run.stage = stage
        await session.flush()

    @staticmethod
    def _resolve_subtitle_style(name: str) -> SubtitleStyle:
        """Return a SubtitleStyle preset by name."""
        presets = {
            "tiktok": SubtitleStyle.tiktok,
            "youtube": SubtitleStyle.youtube,
            "minimal": SubtitleStyle.minimal,
        }
        factory = presets.get(name, SubtitleStyle.tiktok)
        return factory()
