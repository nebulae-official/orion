"""Provider capability catalog for the Orion Provider Service.

Maps (provider, capability) pairs to their configuration: default model,
base URL, credential kind, and any capability-specific defaults such as TTS voice.

Defaults are read from environment variables at import time, matching the
existing per-route env-var pattern so behavior is identical on restart.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import StrEnum


class Capability(StrEnum):
    """AI capability type."""

    LLM = "llm"
    IMAGE = "image"
    TTS = "tts"


class CredentialKind(StrEnum):
    """How credentials are supplied to this provider."""

    API_KEY = "api_key"


@dataclass(frozen=True)
class ProviderEntry:
    """Immutable descriptor for one (provider, capability) combination."""

    provider: str
    capability: Capability
    credential_kind: CredentialKind
    default_model: str
    base_url: str
    default_voice: str | None = None


# ---------------------------------------------------------------------------
# Catalog — all registered (provider, capability) entries
# ---------------------------------------------------------------------------

_CATALOG: list[ProviderEntry] = [
    ProviderEntry(
        provider="nvidia_nim",
        capability=Capability.LLM,
        credential_kind=CredentialKind.API_KEY,
        default_model=os.getenv("PROVIDER_LLM_MODEL", "meta/llama-3.3-70b-instruct"),
        base_url=os.getenv("PROVIDER_LLM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    ),
    ProviderEntry(
        provider="nvidia_nim",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        default_model=os.getenv("PROVIDER_IMAGE_MODEL", "black-forest-labs/flux.1-schnell"),
        base_url=os.getenv("PROVIDER_IMAGE_BASE_URL", "https://ai.api.nvidia.com/v1/genai"),
    ),
    ProviderEntry(
        provider="nvidia_nim",
        capability=Capability.TTS,
        credential_kind=CredentialKind.API_KEY,
        default_model=os.getenv("PROVIDER_TTS_MODEL", "nvidia/magpie-tts-multilingual"),
        base_url=os.getenv("PROVIDER_TTS_BASE_URL", "grpc.nvcf.nvidia.com:443"),
        default_voice=os.getenv("PROVIDER_TTS_VOICE", "Magpie-Multilingual.EN-US.Aria"),
    ),
    ProviderEntry(
        provider="fish_speech",
        capability=Capability.TTS,
        credential_kind=CredentialKind.API_KEY,
        default_model="default",
        base_url=os.getenv("FISH_SPEECH_URL", "http://fish_speech:8080"),
        default_voice=os.getenv("FISH_SPEECH_VOICE", "default"),
    ),
    ProviderEntry(
        provider="huggingface",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        default_model=os.getenv("PROVIDER_HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell"),
        base_url=os.getenv("PROVIDER_HF_BASE_URL", "https://api-inference.huggingface.co"),
    ),
    ProviderEntry(
        provider="pollinations",
        capability=Capability.IMAGE,
        credential_kind=CredentialKind.API_KEY,
        default_model=os.getenv("PROVIDER_POLLINATIONS_MODEL", "flux"),
        base_url=os.getenv("PROVIDER_POLLINATIONS_BASE_URL", "https://image.pollinations.ai"),
    ),
]

_DEFAULT_PROVIDER = "nvidia_nim"


def get_entry(capability: Capability, provider: str = _DEFAULT_PROVIDER) -> ProviderEntry:
    """Return the catalog entry for (provider, capability).

    Raises KeyError if no entry is registered for the combination so callers
    get a clear failure rather than a confusing AttributeError downstream.
    """
    for entry in _CATALOG:
        if entry.capability == capability and entry.provider == provider:
            return entry
    raise KeyError(f"No catalog entry for provider='{provider}' capability='{capability.value}'")


def list_entries() -> list[ProviderEntry]:
    """Return all registered catalog entries (no credentials included)."""
    return list(_CATALOG)
