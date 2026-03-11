"""FFmpeg-based video stitcher that assembles images and audio into a video."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

import structlog
from pydantic import BaseModel, Field

from .effects import build_ken_burns_filter, build_audio_fade_filter

logger = structlog.get_logger(__name__)

DEFAULT_OUTPUT_DIR = "/tmp/orion/editor/video"


class VideoConfig(BaseModel):
    """Configuration for the output video."""

    width: int = 1080
    height: int = 1920  # 9:16 for shorts by default
    fps: int = 30
    duration_per_image: float = 3.0


class StitchRequest(BaseModel):
    """Parameters for a video stitch operation."""

    image_paths: list[str]
    audio_path: str
    output_path: str = ""
    config: VideoConfig = Field(default_factory=VideoConfig)


class VideoStitcher:
    """Create a slideshow video from images with audio overlay using ffmpeg.

    Applies Ken Burns (zoom/pan) effects to each image and crossfade
    transitions, then overlays the audio track.  Output is MP4 (H.264 + AAC).
    """

    def __init__(self, output_dir: str | None = None) -> None:
        self._output_dir = Path(
            output_dir or os.getenv("EDITOR_OUTPUT_DIR", DEFAULT_OUTPUT_DIR)
        )
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def stitch(self, request: StitchRequest) -> str:
        """Stitch images and audio into a video and return the output path."""
        output_path = request.output_path or str(
            self._output_dir / f"{uuid.uuid4()}.mp4"
        )
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        cfg = request.config
        n_images = len(request.image_paths)
        total_duration = n_images * cfg.duration_per_image

        # Build ffmpeg command
        cmd = self._build_ffmpeg_command(
            request.image_paths,
            request.audio_path,
            output_path,
            cfg,
            total_duration,
        )

        await logger.ainfo(
            "stitching_video",
            image_count=n_images,
            output=output_path,
            resolution=f"{cfg.width}x{cfg.height}",
        )

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode(errors="replace")
            await logger.aerror(
                "ffmpeg_stitch_failed",
                returncode=process.returncode,
                stderr=error_msg[:2000],
            )
            raise RuntimeError(f"ffmpeg stitching failed: {error_msg[:500]}")

        await logger.ainfo("video_stitched", output=output_path)
        return output_path

    def _build_ffmpeg_command(
        self,
        image_paths: list[str],
        audio_path: str,
        output_path: str,
        cfg: VideoConfig,
        total_duration: float,
    ) -> list[str]:
        """Construct the ffmpeg command for stitching."""
        cmd: list[str] = ["ffmpeg", "-y"]

        # Input each image as a loop with its display duration
        for img in image_paths:
            cmd.extend([
                "-loop", "1",
                "-t", str(cfg.duration_per_image),
                "-i", img,
            ])

        # Audio input
        cmd.extend(["-i", audio_path])

        n = len(image_paths)
        audio_input_idx = n  # audio is the last input

        # Build complex filter graph
        filter_parts: list[str] = []

        # Scale each image and apply Ken Burns effect
        for i in range(n):
            kb_filter = build_ken_burns_filter(
                idx=i,
                width=cfg.width,
                height=cfg.height,
                fps=cfg.fps,
                duration=cfg.duration_per_image,
            )
            filter_parts.append(
                f"[{i}:v]scale={cfg.width}:{cfg.height}"
                f":force_original_aspect_ratio=decrease,"
                f"pad={cfg.width}:{cfg.height}:(ow-iw)/2:(oh-ih)/2:black,"
                f"{kb_filter}[v{i}]"
            )

        # Concatenate all video segments
        concat_inputs = "".join(f"[v{i}]" for i in range(n))
        filter_parts.append(
            f"{concat_inputs}concat=n={n}:v=1:a=0[outv]"
        )

        # Audio fade
        audio_fade = build_audio_fade_filter(total_duration)
        filter_parts.append(
            f"[{audio_input_idx}:a]{audio_fade}[outa]"
        )

        filter_graph = ";\n".join(filter_parts)

        cmd.extend([
            "-filter_complex", filter_graph,
            "-map", "[outv]",
            "-map", "[outa]",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-pix_fmt", "yuv420p",
            output_path,
        ])

        return cmd
