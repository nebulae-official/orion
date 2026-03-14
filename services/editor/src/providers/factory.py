"""Factory for constructing the configured TTS provider."""

from __future__ import annotations

import os

import structlog
from orion_common.config import CommonSettings

from .base import TTSProvider
from .elevenlabs import ElevenLabsProvider
from .fish_speech import FishSpeechProvider

logger = structlog.get_logger(__name__)


def get_tts_provider(settings: CommonSettings | None = None) -> TTSProvider:
    """Return the appropriate TTS provider based on configuration.

    Supports ``EDITOR_TTS_PROVIDER`` values:
    - ``LOCAL`` — Fish Speech (local, no API key required)
    - ``CLOUD`` or ``ELEVENLABS`` — ElevenLabs (default)
    """
    output_dir = os.getenv("EDITOR_OUTPUT_DIR", "/tmp/orion/editor/tts")
    provider_name = os.getenv("EDITOR_TTS_PROVIDER", "CLOUD").upper()

    if provider_name == "LOCAL":
        logger.info("tts_provider_selected", provider="fish_speech")
        return FishSpeechProvider(output_dir=output_dir)

    logger.info("tts_provider_selected", provider="elevenlabs")
    return ElevenLabsProvider(output_dir=output_dir)
