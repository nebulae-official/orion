"""Factory for constructing the configured TTS provider."""

from __future__ import annotations

import os

from orion_common.config import CommonSettings

from .base import TTSProvider
from .elevenlabs import ElevenLabsProvider


def get_tts_provider(settings: CommonSettings | None = None) -> TTSProvider:
    """Return the appropriate TTS provider based on configuration.

    Currently only ElevenLabs is supported; this factory exists so that
    additional providers (e.g. local Coqui TTS) can be added later.
    """
    output_dir = os.getenv("EDITOR_OUTPUT_DIR", "/tmp/orion/editor/tts")
    return ElevenLabsProvider(output_dir=output_dir)
