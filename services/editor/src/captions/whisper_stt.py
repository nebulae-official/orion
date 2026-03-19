"""Speech-to-text captioning using faster-whisper."""

from __future__ import annotations

import asyncio
import os

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

DEFAULT_MODEL_SIZE = "base"


class WordSegment(BaseModel):
    """A single word with its timing information."""

    word: str
    start: float
    end: float


class CaptionSegment(BaseModel):
    """A caption segment (typically a phrase or sentence)."""

    start: float
    end: float
    text: str
    words: list[WordSegment] = Field(default_factory=list)


class CaptionResult(BaseModel):
    """Full captioning result with segments and metadata."""

    segments: list[CaptionSegment]
    full_text: str
    language: str
    words: list[WordSegment] = Field(default_factory=list)


class WhisperCaptioner:
    """Transcribe audio to text with word-level timestamps using faster-whisper.

    The underlying model is loaded lazily on first use and cached for reuse.
    """

    def __init__(self, model_size: str | None = None) -> None:
        self._model_size = model_size or os.getenv("WHISPER_MODEL_SIZE", DEFAULT_MODEL_SIZE)
        self._model = None

    def _get_model(self):
        """Lazily load the faster-whisper model."""
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(
                self._model_size,
                device="cpu",
                compute_type="int8",
            )
        return self._model

    async def transcribe(self, audio_path: str, language: str = "en") -> CaptionResult:
        """Transcribe *audio_path* and return word-level captions.

        The heavy Whisper inference runs in a thread executor to avoid
        blocking the async event loop.
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._transcribe_sync, audio_path, language)
        await logger.ainfo(
            "audio_transcribed",
            audio_path=audio_path,
            language=language,
            segment_count=len(result.segments),
        )
        return result

    def _transcribe_sync(self, audio_path: str, language: str) -> CaptionResult:
        """Synchronous transcription -- runs in a thread pool."""
        model = self._get_model()

        segments_iter, info = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
            vad_filter=True,
        )

        caption_segments: list[CaptionSegment] = []
        all_words: list[WordSegment] = []
        full_text_parts: list[str] = []

        for segment in segments_iter:
            words: list[WordSegment] = []
            if segment.words:
                for w in segment.words:
                    ws = WordSegment(
                        word=w.word.strip(),
                        start=round(w.start, 3),
                        end=round(w.end, 3),
                    )
                    words.append(ws)
                    all_words.append(ws)

            caption_segments.append(
                CaptionSegment(
                    start=round(segment.start, 3),
                    end=round(segment.end, 3),
                    text=segment.text.strip(),
                    words=words,
                )
            )
            full_text_parts.append(segment.text.strip())

        return CaptionResult(
            segments=caption_segments,
            full_text=" ".join(full_text_parts),
            language=info.language,
            words=all_words,
        )
