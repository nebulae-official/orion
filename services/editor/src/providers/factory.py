"""Factory for constructing the configured TTS provider."""

from __future__ import annotations

import structlog

from .base import TTSProvider
from .provider_client import ProviderServiceTTSClient

# Legacy providers kept for reference — not imported or constructed.
# from .elevenlabs import ElevenLabsProvider
# from .fish_speech import FishSpeechProvider

logger = structlog.get_logger(__name__)


def get_tts_provider(settings=None) -> TTSProvider:  # noqa: ARG001 — kept for API compatibility
    """Return the Provider Service TTS client.

    All speech synthesis is now routed through the centralised Provider Service
    (ORION-246).  Legacy ElevenLabs / Fish Speech construction has been removed.
    """
    logger.info("tts_provider_selected", provider="provider_service")
    return ProviderServiceTTSClient()
