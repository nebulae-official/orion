"""Burn karaoke-style subtitles into video using ffmpeg and ASS format."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

import structlog
from pydantic import BaseModel

from ..captions.formatter import to_ass
from ..captions.whisper_stt import CaptionResult

logger = structlog.get_logger(__name__)

DEFAULT_OUTPUT_DIR = "/tmp/orion/editor/video"


class SubtitleStyle(BaseModel):
    """Visual style configuration for burned-in subtitles."""

    font_name: str = "Arial"
    font_size: int = 20
    primary_color: str = "&H00FFFFFF"  # white (ASS BGR format)
    highlight_color: str = "&H0000FFFF"  # yellow highlight for karaoke
    outline_width: int = 2
    position: str = "bottom"  # "bottom", "center", "top"

    # Preset helpers -----------------------------------------------------------

    @classmethod
    def tiktok(cls) -> SubtitleStyle:
        """Bold, large subtitles typical of TikTok-style videos."""
        return cls(
            font_name="Impact",
            font_size=28,
            primary_color="&H00FFFFFF",
            highlight_color="&H0000FFFF",
            outline_width=3,
            position="center",
        )

    @classmethod
    def youtube(cls) -> SubtitleStyle:
        """Clean YouTube-style subtitles at the bottom."""
        return cls(
            font_name="Roboto",
            font_size=22,
            primary_color="&H00FFFFFF",
            highlight_color="&H0042D4FF",
            outline_width=2,
            position="bottom",
        )

    @classmethod
    def minimal(cls) -> SubtitleStyle:
        """Minimal, small subtitles."""
        return cls(
            font_name="Helvetica",
            font_size=16,
            primary_color="&H00CCCCCC",
            highlight_color="&H00FFFFFF",
            outline_width=1,
            position="bottom",
        )


class SubtitleBurner:
    """Burn ASS subtitles with karaoke word-highlighting into a video."""

    def __init__(self, output_dir: str | None = None) -> None:
        self._output_dir = Path(
            output_dir or os.getenv("EDITOR_OUTPUT_DIR", DEFAULT_OUTPUT_DIR)
        )
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def burn_subtitles(
        self,
        video_path: str,
        caption_result: CaptionResult,
        style: SubtitleStyle,
        output_path: str = "",
    ) -> str:
        """Generate an ASS file from *caption_result* and burn it into the video.

        Returns the path to the output video with subtitles burned in.
        """
        output_path = output_path or str(
            self._output_dir / f"{uuid.uuid4()}_subtitled.mp4"
        )
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Generate ASS subtitle file
        ass_content = to_ass(
            caption_result,
            font_name=style.font_name,
            font_size=style.font_size,
            primary_color=style.primary_color,
            highlight_color=style.highlight_color,
            outline_width=style.outline_width,
        )

        ass_path = str(self._output_dir / f"{uuid.uuid4()}.ass")
        Path(ass_path).write_text(ass_content, encoding="utf-8")

        # Escape special characters in the ASS path for ffmpeg filter
        escaped_ass = ass_path.replace("\\", "\\\\").replace(":", "\\:")

        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vf", f"ass={escaped_ass}",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "copy",
            "-pix_fmt", "yuv420p",
            output_path,
        ]

        await logger.ainfo(
            "burning_subtitles",
            video_path=video_path,
            style=style.font_name,
            output=output_path,
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
                "ffmpeg_subtitle_burn_failed",
                returncode=process.returncode,
                stderr=error_msg[:2000],
            )
            raise RuntimeError(
                f"ffmpeg subtitle burn failed: {error_msg[:500]}"
            )

        # Clean up temporary ASS file
        Path(ass_path).unlink(missing_ok=True)

        await logger.ainfo("subtitles_burned", output=output_path)
        return output_path
