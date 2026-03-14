"""Thumbnail generation from video frames with text overlay."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

import structlog
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

DEFAULT_OUTPUT_DIR = "/tmp/orion/editor/thumbnails"

# Platform-specific output sizes
THUMBNAIL_SIZES: dict[str, tuple[int, int]] = {
    "youtube": (1280, 720),
    "reels": (1080, 1920),
    "tiktok": (1080, 1920),
}


class NicheStyle(BaseModel):
    """Visual styling for a specific content niche."""

    font_path: str = ""
    font_size: int = 72
    text_color: str = "#FFFFFF"
    stroke_color: str = "#000000"
    stroke_width: int = 3
    overlay_opacity: float = Field(default=0.4, ge=0.0, le=1.0)


# Default niche styles
NICHE_STYLES: dict[str, NicheStyle] = {
    "tech": NicheStyle(
        font_size=68,
        text_color="#00FF88",
        stroke_color="#001a0d",
        stroke_width=4,
    ),
    "finance": NicheStyle(
        font_size=64,
        text_color="#FFD700",
        stroke_color="#1a1400",
        stroke_width=3,
    ),
    "lifestyle": NicheStyle(
        font_size=72,
        text_color="#FFFFFF",
        stroke_color="#333333",
        stroke_width=3,
    ),
    "default": NicheStyle(),
}


class ThumbnailGenerator:
    """Generate thumbnails by extracting a video frame and adding text overlay.

    Extracts a frame from the hook section (0-3 seconds) using ffmpeg,
    then applies niche-specific styling with Pillow.
    """

    def __init__(self, output_dir: str | None = None) -> None:
        self._output_dir = Path(
            output_dir or os.getenv("EDITOR_THUMBNAIL_DIR", DEFAULT_OUTPUT_DIR)
        )
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def generate(
        self,
        video_path: str,
        title: str,
        platform: str = "youtube",
        niche: str = "default",
        frame_time: float = 1.5,
    ) -> str:
        """Generate a thumbnail for the given video and return the file path.

        Parameters
        ----------
        video_path:
            Path to the source video.
        title:
            Text to overlay on the thumbnail.
        platform:
            Target platform (``youtube``, ``reels``, ``tiktok``).
        niche:
            Content niche for styling (``tech``, ``finance``, ``lifestyle``).
        frame_time:
            Timestamp in seconds to extract the frame from (hook section 0-3s).
        """
        # Clamp frame_time to 0-3 seconds (hook section)
        frame_time = max(0.0, min(frame_time, 3.0))

        width, height = THUMBNAIL_SIZES.get(platform, THUMBNAIL_SIZES["youtube"])
        style = NICHE_STYLES.get(niche, NICHE_STYLES["default"])

        # Extract frame from video
        frame_path = await self._extract_frame(video_path, frame_time, width, height)

        # Apply text overlay
        thumbnail_path = self._apply_text_overlay(
            frame_path, title, width, height, style
        )

        # Clean up intermediate frame
        Path(frame_path).unlink(missing_ok=True)

        await logger.ainfo(
            "thumbnail_generated",
            platform=platform,
            niche=niche,
            resolution=f"{width}x{height}",
            output=thumbnail_path,
        )

        return thumbnail_path

    async def _extract_frame(
        self, video_path: str, time_sec: float, width: int, height: int
    ) -> str:
        """Extract a single frame from the video using ffmpeg."""
        frame_path = str(self._output_dir / f"frame_{uuid.uuid4()}.png")

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(time_sec),
            "-i", video_path,
            "-vframes", "1",
            "-vf", (
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
            ),
            frame_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode(errors="replace")
            raise RuntimeError(
                f"ffmpeg frame extraction failed: {error_msg[:500]}"
            )

        return frame_path

    def _apply_text_overlay(
        self,
        frame_path: str,
        title: str,
        width: int,
        height: int,
        style: NicheStyle,
    ) -> str:
        """Apply a dark overlay and title text to the extracted frame."""
        img = Image.open(frame_path).convert("RGBA")
        img = img.resize((width, height), Image.LANCZOS)

        # Semi-transparent dark overlay for text readability
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw_overlay = ImageDraw.Draw(overlay)
        overlay_alpha = int(255 * style.overlay_opacity)
        draw_overlay.rectangle(
            [(0, height // 2), (width, height)],
            fill=(0, 0, 0, overlay_alpha),
        )
        img = Image.alpha_composite(img, overlay)

        # Load font
        try:
            if style.font_path and Path(style.font_path).exists():
                font = ImageFont.truetype(style.font_path, style.font_size)
            else:
                font = ImageFont.truetype(
                    "DejaVuSans-Bold.ttf", style.font_size
                )
        except OSError:
            font = ImageFont.load_default()

        # Draw title text
        draw = ImageDraw.Draw(img)
        # Word wrap
        lines = self._wrap_text(draw, title, font, int(width * 0.85))

        # Position text in lower third
        line_height = style.font_size + 10
        total_text_height = len(lines) * line_height
        y_start = height - total_text_height - int(height * 0.08)

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            y = y_start + i * line_height

            # Stroke / outline
            draw.text(
                (x, y),
                line,
                font=font,
                fill=style.text_color,
                stroke_width=style.stroke_width,
                stroke_fill=style.stroke_color,
            )

        # Convert to RGB and save as JPEG
        output_path = str(self._output_dir / f"thumb_{uuid.uuid4()}.jpg")
        img.convert("RGB").save(output_path, "JPEG", quality=95)
        return output_path

    @staticmethod
    def _wrap_text(
        draw: ImageDraw.ImageDraw,
        text: str,
        font: ImageFont.FreeTypeFont,
        max_width: int,
    ) -> list[str]:
        """Word-wrap text to fit within max_width pixels."""
        words = text.split()
        lines: list[str] = []
        current_line = ""

        for word in words:
            test_line = f"{current_line} {word}".strip()
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word

        if current_line:
            lines.append(current_line)

        return lines or [text]
