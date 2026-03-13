"""Credential encryption/decryption using Fernet symmetric encryption."""

from __future__ import annotations

import json
import os

from cryptography.fernet import Fernet, InvalidToken


def _get_key() -> bytes:
    """Get the Fernet encryption key from env.

    Raises RuntimeError if ORION_ENCRYPTION_KEY is not set.
    """
    key = os.environ.get("ORION_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "ORION_ENCRYPTION_KEY environment variable is required but not set. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return key.encode()


def validate_encryption_key() -> None:
    """Validate that the encryption key is set and is a valid Fernet key.

    Should be called during application startup to fail fast.

    Raises:
        RuntimeError: If the key is missing or not a valid Fernet key.
    """
    key = _get_key()
    try:
        Fernet(key)
    except (ValueError, InvalidToken) as exc:
        raise RuntimeError(
            f"ORION_ENCRYPTION_KEY is not a valid Fernet key: {exc}. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        ) from exc


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the validated key."""
    return Fernet(_get_key())


def encrypt_credentials(creds: dict[str, str]) -> str:
    """Encrypt a credentials dict to a string for DB storage."""
    plaintext = json.dumps(creds).encode()
    return _get_fernet().encrypt(plaintext).decode()


def decrypt_credentials(encrypted: str) -> dict[str, str]:
    """Decrypt a stored credentials string back to a dict."""
    plaintext = _get_fernet().decrypt(encrypted.encode())
    return json.loads(plaintext)
