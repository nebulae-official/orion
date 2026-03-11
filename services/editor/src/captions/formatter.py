"""Convert CaptionResult to various subtitle formats (SRT, ASS, JSON)."""

from __future__ import annotations

import json
from typing import Any

from .whisper_stt import CaptionResult


def _format_srt_time(seconds: float) -> str:
    """Format seconds as SRT timestamp ``HH:MM:SS,mmm``."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _format_ass_time(seconds: float) -> str:
    """Format seconds as ASS timestamp ``H:MM:SS.cc`` (centiseconds)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def to_srt(result: CaptionResult) -> str:
    """Convert a CaptionResult to SRT subtitle format."""
    lines: list[str] = []
    for idx, seg in enumerate(result.segments, start=1):
        start = _format_srt_time(seg.start)
        end = _format_srt_time(seg.end)
        lines.append(f"{idx}")
        lines.append(f"{start} --> {end}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines)


def to_ass(
    result: CaptionResult,
    font_name: str = "Arial",
    font_size: int = 20,
    primary_color: str = "&H00FFFFFF",
    highlight_color: str = "&H0000FFFF",
    outline_width: int = 2,
) -> str:
    """Convert a CaptionResult to ASS format with karaoke word-level timing.

    Each segment becomes a Dialogue line.  If word-level timestamps are
    available, ``{\\kf<duration>}`` tags are used so that individual words
    highlight as they are spoken (karaoke effect).
    """
    header = (
        "[Script Info]\n"
        "Title: Orion Karaoke Subtitles\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "WrapStyle: 0\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},{primary_color},"
        f"{highlight_color},&H00000000,&H80000000,"
        f"-1,0,0,0,100,100,0,0,1,{outline_width},0,2,10,10,50,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )

    dialogue_lines: list[str] = []
    for seg in result.segments:
        start = _format_ass_time(seg.start)
        end = _format_ass_time(seg.end)

        if seg.words:
            # Build karaoke-tagged text
            parts: list[str] = []
            for word in seg.words:
                duration_cs = int((word.end - word.start) * 100)
                parts.append(f"{{\\kf{duration_cs}}}{word.word}")
            text = " ".join(parts)
        else:
            text = seg.text

        dialogue_lines.append(
            f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}"
        )

    return header + "\n".join(dialogue_lines) + "\n"


def to_word_json(result: CaptionResult) -> str:
    """Convert word-level timestamps to a JSON string for karaoke rendering."""
    words: list[dict[str, Any]] = [
        {"word": w.word, "start": w.start, "end": w.end}
        for w in result.words
    ]
    return json.dumps({"words": words, "language": result.language}, indent=2)
