"""Unit tests for the provider capability catalog (ORION-258)."""

from __future__ import annotations

import pytest
from src.catalog import Capability, CredentialKind, get_entry, list_entries

# ---------------------------------------------------------------------------
# get_entry — resolution
# ---------------------------------------------------------------------------


def test_get_entry_llm_nvidia_nim() -> None:
    """LLM entry for nvidia_nim resolves to expected defaults."""
    entry = get_entry(Capability.LLM)

    assert entry.provider == "nvidia_nim"
    assert entry.capability == Capability.LLM
    assert entry.credential_kind == CredentialKind.API_KEY
    assert "llama" in entry.default_model.lower() or entry.default_model  # non-empty
    assert entry.base_url.startswith("https://")


def test_get_entry_image_nvidia_nim() -> None:
    """Image entry for nvidia_nim resolves to expected defaults."""
    entry = get_entry(Capability.IMAGE)

    assert entry.provider == "nvidia_nim"
    assert entry.capability == Capability.IMAGE
    assert entry.credential_kind == CredentialKind.API_KEY
    assert entry.default_model  # non-empty
    assert entry.base_url.startswith("https://")


def test_get_entry_tts_nvidia_nim() -> None:
    """TTS entry for nvidia_nim has a default voice set."""
    entry = get_entry(Capability.TTS)

    assert entry.provider == "nvidia_nim"
    assert entry.capability == Capability.TTS
    assert entry.credential_kind == CredentialKind.API_KEY
    assert entry.default_model
    assert entry.default_voice is not None


def test_get_entry_explicit_provider_name() -> None:
    """Passing provider explicitly returns the same entry as the default."""
    default_entry = get_entry(Capability.LLM)
    explicit_entry = get_entry(Capability.LLM, "nvidia_nim")

    assert default_entry == explicit_entry


def test_get_entry_unknown_provider_raises() -> None:
    """KeyError is raised for an unregistered (provider, capability) pair."""
    with pytest.raises(KeyError, match="no_such_provider"):
        get_entry(Capability.LLM, "no_such_provider")


def test_get_entry_frozen_entry_is_immutable() -> None:
    """ProviderEntry is a frozen dataclass — mutation raises FrozenInstanceError."""
    entry = get_entry(Capability.LLM)

    with pytest.raises(Exception):  # dataclasses.FrozenInstanceError
        entry.default_model = "tampered"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# list_entries — catalog completeness
# ---------------------------------------------------------------------------


def test_list_entries_returns_all_three_capabilities() -> None:
    """Catalog must contain entries for all three capabilities."""
    entries = list_entries()
    capabilities = {e.capability for e in entries}

    assert Capability.LLM in capabilities
    assert Capability.IMAGE in capabilities
    assert Capability.TTS in capabilities


def test_list_entries_no_credentials_exposed() -> None:
    """Catalog entries must not contain any API key or secret data."""
    for entry in list_entries():
        assert "nvapi" not in (entry.default_model or "").lower()
        assert "nvapi" not in (entry.base_url or "").lower()
        assert "nvapi" not in (entry.default_voice or "").lower()


def test_list_entries_returns_copy() -> None:
    """list_entries() returns a new list — mutating it doesn't affect the catalog."""
    entries = list_entries()
    original_length = len(entries)
    entries.clear()

    assert len(list_entries()) == original_length
