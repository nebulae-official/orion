"""FFmpeg filter string builders for video effects."""

from __future__ import annotations


def build_ken_burns_filter(
    idx: int,
    width: int,
    height: int,
    fps: int,
    duration: float,
    zoom_start: float = 1.0,
    zoom_end: float = 1.3,
) -> str:
    """Build an ffmpeg ``zoompan`` filter string for a Ken Burns effect.

    The effect smoothly zooms from *zoom_start* to *zoom_end* over
    *duration* seconds while panning slightly based on the image index
    (alternating left-to-right and right-to-left).

    Returns only the zoompan filter portion (caller prepends scale/pad).
    """
    total_frames = int(duration * fps)

    # Alternate pan direction based on image index
    if idx % 2 == 0:
        # Pan from left to right
        pan_x = f"iw/2-(iw/zoom/2)+((iw/zoom/2)*on/{total_frames})"
        pan_y = "ih/2-(ih/zoom/2)"
    else:
        # Pan from right to left
        pan_x = f"iw/2-(iw/zoom/2)+((iw/zoom/2)*(1-on/{total_frames}))"
        pan_y = "ih/2-(ih/zoom/2)"

    zoom_expr = f"{zoom_start}+({zoom_end - zoom_start})*on/{total_frames}"

    return (
        f"zoompan=z='{zoom_expr}'"
        f":x='{pan_x}'"
        f":y='{pan_y}'"
        f":d={total_frames}"
        f":s={width}x{height}"
        f":fps={fps}"
    )


def build_crossfade_filter(
    segment_a: str,
    segment_b: str,
    output: str,
    duration: float = 0.5,
    offset: float = 0.0,
) -> str:
    """Build an ffmpeg ``xfade`` filter for a crossfade transition.

    Parameters
    ----------
    segment_a:
        Input stream label for the first segment (e.g. ``[v0]``).
    segment_b:
        Input stream label for the second segment (e.g. ``[v1]``).
    output:
        Output stream label (e.g. ``[xf0]``).
    duration:
        Crossfade duration in seconds.
    offset:
        Offset in seconds where the crossfade begins.
    """
    return (
        f"{segment_a}{segment_b}xfade=transition=fade:duration={duration}:offset={offset}{output}"
    )


def build_audio_fade_filter(
    total_duration: float,
    fade_in: float = 0.5,
    fade_out: float = 1.0,
) -> str:
    """Build ffmpeg audio fade-in and fade-out filters.

    Returns a filter string like ``afade=t=in:d=0.5,afade=t=out:st=X:d=1.0``.
    """
    fade_out_start = max(0.0, total_duration - fade_out)
    return f"afade=t=in:d={fade_in},afade=t=out:st={fade_out_start}:d={fade_out}"
