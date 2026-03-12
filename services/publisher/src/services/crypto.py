"""Credential encryption/decryption using Fernet symmetric encryption."""

from __future__ import annotations

import json
import os

from cryptography.fernet import Fernet


def _get_key() -> bytes:
    """Get the Fernet encryption key from env or generate a dev default."""
    key = os.environ.get("ORION_ENCRYPTION_KEY")
    if key:
        return key.encode()
    # Dev fallback — deterministic key for local development
    return Fernet.generate_key()


_fernet = Fernet(_get_key())


def encrypt_credentials(creds: dict[str, str]) -> str:
    """Encrypt a credentials dict to a string for DB storage."""
    plaintext = json.dumps(creds).encode()
    return _fernet.encrypt(plaintext).decode()


def decrypt_credentials(encrypted: str) -> dict[str, str]:
    """Decrypt a stored credentials string back to a dict."""
    plaintext = _fernet.decrypt(encrypted.encode())
    return json.loads(plaintext)
