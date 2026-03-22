"""Unit tests for the Fernet encryption module (ORION-175)."""

from __future__ import annotations

import pytest
import src.identity.encryption as encryption_mod
from cryptography.fernet import Fernet


@pytest.fixture(autouse=True)
def _reset_key_cache() -> None:
    """Reset the module-level _KEY cache before every test."""
    encryption_mod._KEY = None


@pytest.fixture
def fernet_key() -> str:
    """Generate a fresh Fernet key for testing."""
    return Fernet.generate_key().decode()


@pytest.fixture
def _set_encryption_key(monkeypatch: pytest.MonkeyPatch, fernet_key: str) -> None:
    """Set ORION_ENCRYPTION_KEY in the environment."""
    monkeypatch.setenv("ORION_ENCRYPTION_KEY", fernet_key)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("_set_encryption_key")
class TestEncryptDecrypt:
    """Encryption round-trip and token uniqueness tests."""

    def test_encrypt_decrypt_roundtrip(self) -> None:
        """Encrypting then decrypting returns the original plaintext."""
        plaintext = "sk-abc123-super-secret-key"
        token = encryption_mod.encrypt(plaintext)
        assert encryption_mod.decrypt(token) == plaintext

    def test_encrypt_produces_different_tokens(self) -> None:
        """Same plaintext produces different ciphertext (Fernet uses random IV)."""
        plaintext = "sk-same-key-twice"
        token_a = encryption_mod.encrypt(plaintext)
        token_b = encryption_mod.encrypt(plaintext)
        assert token_a != token_b
        # Both must still decrypt to the same value
        assert encryption_mod.decrypt(token_a) == plaintext
        assert encryption_mod.decrypt(token_b) == plaintext


@pytest.mark.usefixtures("_set_encryption_key")
def test_decrypt_invalid_token_raises() -> None:
    """Decrypting garbage input raises ValueError."""
    with pytest.raises(ValueError, match="Failed to decrypt"):
        encryption_mod.decrypt("not-a-valid-fernet-token")


def test_missing_encryption_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Calling encrypt/decrypt without ORION_ENCRYPTION_KEY raises RuntimeError."""
    monkeypatch.delenv("ORION_ENCRYPTION_KEY", raising=False)

    with pytest.raises(RuntimeError, match="ORION_ENCRYPTION_KEY is not set"):
        encryption_mod.encrypt("anything")
