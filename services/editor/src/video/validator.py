"""Video quality validation before platform upload."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# Expected constraints for short-form vertical video
EXPECTED_WIDTH = 1080
EXPECTED_HEIGHT = 1920
EXPECTED_CODEC = "h264"
EXPECTED_FPS = 30
MIN_DURATION_SECS = 55.0
MAX_DURATION_SECS = 60.0
MAX_FILE_SIZE_MB = 500


class ValidationIssue(BaseModel):
    """A single validation check result."""

    check: str
    passed: bool
    expected: str
    actual: str
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class ValidationResult(BaseModel):
    """Aggregate result of all video quality checks."""

    valid: bool
    confidence_score: float = Field(ge=0.0, le=1.0)
    issues: list[ValidationIssue]
    file_path: str
    metadata: dict | None = None


class VideoValidator:
    """Validate video files against quality requirements for platform upload.

    Checks resolution, codec, FPS, duration, and file size using ffprobe.
    Generates a confidence score (0-1) based on how many checks pass.
    """

    async def validate(self, video_path: str) -> ValidationResult:
        """Run all validation checks on the video file and return result."""
        if not Path(video_path).exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        probe_data = await self._probe_video(video_path)
        file_size_mb = os.path.getsize(video_path) / (1024 * 1024)

        video_stream = self._find_video_stream(probe_data)
        if video_stream is None:
            return ValidationResult(
                valid=False,
                confidence_score=0.0,
                issues=[
                    ValidationIssue(
                        check="video_stream",
                        passed=False,
                        expected="video stream present",
                        actual="no video stream found",
                    )
                ],
                file_path=video_path,
            )

        width = video_stream.get("width", 0)
        height = video_stream.get("height", 0)
        codec = video_stream.get("codec_name", "unknown")
        duration = float(
            probe_data.get("format", {}).get("duration", 0)
        )

        # Parse FPS from r_frame_rate (e.g. "30/1")
        fps_str = video_stream.get("r_frame_rate", "0/1")
        fps = self._parse_fps(fps_str)

        issues: list[ValidationIssue] = []

        # Resolution check
        issues.append(
            ValidationIssue(
                check="resolution",
                passed=(
                    width == EXPECTED_WIDTH and height == EXPECTED_HEIGHT
                ),
                expected=f"{EXPECTED_WIDTH}x{EXPECTED_HEIGHT}",
                actual=f"{width}x{height}",
                weight=1.0,
            )
        )

        # Codec check
        issues.append(
            ValidationIssue(
                check="codec",
                passed=(codec.lower() == EXPECTED_CODEC),
                expected=EXPECTED_CODEC,
                actual=codec,
                weight=1.0,
            )
        )

        # FPS check (allow +-1 tolerance)
        fps_ok = abs(fps - EXPECTED_FPS) <= 1
        issues.append(
            ValidationIssue(
                check="fps",
                passed=fps_ok,
                expected=str(EXPECTED_FPS),
                actual=f"{fps:.1f}",
                weight=0.8,
            )
        )

        # Duration check
        duration_ok = MIN_DURATION_SECS <= duration <= MAX_DURATION_SECS
        issues.append(
            ValidationIssue(
                check="duration",
                passed=duration_ok,
                expected=f"{MIN_DURATION_SECS}-{MAX_DURATION_SECS}s",
                actual=f"{duration:.1f}s",
                weight=0.8,
            )
        )

        # File size check
        size_ok = file_size_mb <= MAX_FILE_SIZE_MB
        issues.append(
            ValidationIssue(
                check="file_size",
                passed=size_ok,
                expected=f"<= {MAX_FILE_SIZE_MB} MB",
                actual=f"{file_size_mb:.1f} MB",
                weight=0.5,
            )
        )

        # Calculate weighted confidence score
        total_weight = sum(issue.weight for issue in issues)
        passed_weight = sum(
            issue.weight for issue in issues if issue.passed
        )
        confidence_score = (
            passed_weight / total_weight if total_weight > 0 else 0.0
        )

        valid = all(issue.passed for issue in issues)

        await logger.ainfo(
            "video_validated",
            video_path=video_path,
            valid=valid,
            confidence_score=round(confidence_score, 3),
            checks_passed=sum(1 for i in issues if i.passed),
            checks_total=len(issues),
        )

        return ValidationResult(
            valid=valid,
            confidence_score=round(confidence_score, 3),
            issues=issues,
            file_path=video_path,
            metadata={
                "width": width,
                "height": height,
                "codec": codec,
                "fps": fps,
                "duration": duration,
                "file_size_mb": round(file_size_mb, 2),
            },
        )

    async def _probe_video(self, video_path: str) -> dict:
        """Run ffprobe to extract video metadata as JSON."""
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode(errors="replace")
            raise RuntimeError(f"ffprobe failed: {error_msg[:500]}")

        return json.loads(stdout.decode())

    @staticmethod
    def _find_video_stream(probe_data: dict) -> dict | None:
        """Find the first video stream in ffprobe output."""
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                return stream
        return None

    @staticmethod
    def _parse_fps(fps_str: str) -> float:
        """Parse an ffprobe r_frame_rate string like '30/1' to a float."""
        try:
            parts = fps_str.split("/")
            if len(parts) == 2:
                num, den = float(parts[0]), float(parts[1])
                return num / den if den != 0 else 0.0
            return float(parts[0])
        except (ValueError, ZeroDivisionError):
            return 0.0
