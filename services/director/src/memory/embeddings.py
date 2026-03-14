"""Embedding generation for vector memory operations.

Provides a pluggable interface for generating text embeddings. The default
implementation uses a deterministic hash-based approach as a placeholder
until a sentence-transformers or API-based backend is configured.
"""

from __future__ import annotations

import hashlib
import struct
from abc import ABC, abstractmethod

import structlog
from orion_common.milvus_client import EMBEDDING_DIM

logger = structlog.get_logger(__name__)


class EmbeddingProvider(ABC):
    """Abstract base for embedding generation backends."""

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text.

        Args:
            text: Input text to embed.

        Returns:
            A list of floats with length ``EMBEDDING_DIM``.
        """
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embedding vectors for a batch of texts.

        Args:
            texts: List of input texts.

        Returns:
            List of embedding vectors, one per input text.
        """
        ...


class HashEmbeddingProvider(EmbeddingProvider):
    """Deterministic hash-based embedding placeholder.

    Generates consistent pseudo-embeddings by hashing the input text.
    This is suitable for development and testing but should be replaced
    with a real embedding model (e.g. sentence-transformers, OpenAI
    embeddings) in production.
    """

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self._dim = dim

    async def embed(self, text: str) -> list[float]:
        """Generate a deterministic pseudo-embedding from text hash."""
        return self._hash_to_vector(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate pseudo-embeddings for a batch of texts."""
        return [self._hash_to_vector(t) for t in texts]

    def _hash_to_vector(self, text: str) -> list[float]:
        """Convert text to a fixed-dimension vector using SHA-512 cycling.

        Repeatedly hashes the text with a counter suffix to fill the
        required dimension, then normalises to unit length.
        """
        vector: list[float] = []
        counter = 0

        while len(vector) < self._dim:
            digest = hashlib.sha512(
                f"{text}:{counter}".encode()
            ).digest()
            # Unpack 64 bytes into 8 float64 values
            floats = struct.unpack("8d", digest)
            vector.extend(floats)
            counter += 1

        vector = vector[: self._dim]

        # Normalise to unit length
        magnitude = sum(v * v for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]

        return vector


def get_embedding_provider() -> EmbeddingProvider:
    """Return the configured embedding provider.

    Currently returns the hash-based placeholder. Swap this factory
    when integrating a real embedding model.
    """
    logger.info("embedding_provider_selected", provider="hash_placeholder")
    return HashEmbeddingProvider()
