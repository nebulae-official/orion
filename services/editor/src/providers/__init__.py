"""TTS provider implementations for the Editor service."""

from .base import TTSProvider, TTSRequest, TTSResult
from .elevenlabs import ElevenLabsProvider
from .factory import get_tts_provider
from .fish_speech import FishSpeechProvider

__all__ = [
    "TTSProvider",
    "TTSRequest",
    "TTSResult",
    "ElevenLabsProvider",
    "FishSpeechProvider",
    "get_tts_provider",
]
