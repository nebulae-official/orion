"""Fernet-based encryption helpers for sensitive data like API keys."""

from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken

_KEY: bytes | None = None


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the ``ORION_ENCRYPTION_KEY`` env var."""
    global _KEY  # noqa: PLW0603
    if _KEY is None:
        raw = os.environ.get("ORION_ENCRYPTION_KEY", "")
        if not raw:
            raise RuntimeError("ORION_ENCRYPTION_KEY is not set — cannot encrypt/decrypt API keys")
        _KEY = raw.encode() if isinstance(raw, str) else raw
    return Fernet(_KEY)


def encrypt(plaintext: str) -> str:
    """Encrypt *plaintext* and return a URL-safe base64 token string."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet *token* back to plaintext.

    Raises ``InvalidToken`` if the key is wrong or data is corrupted.
    """
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt — invalid key or corrupted data") from None
