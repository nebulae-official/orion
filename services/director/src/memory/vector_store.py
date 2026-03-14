"""Vector memory store backed by Milvus for hook and content embeddings."""

from __future__ import annotations

from typing import Any

import structlog
from orion_common.milvus_client import OrionMilvusClient

from .embeddings import EmbeddingProvider

logger = structlog.get_logger(__name__)


class VectorMemory:
    """High-level interface for storing and querying vector memories.

    Wraps the Milvus client and embedding provider to offer simple
    operations for the Director service:

    - Store hook embeddings with engagement metrics after content approval.
    - Query top-K similar past hooks as few-shot examples before generation.
    """

    def __init__(
        self,
        milvus_client: OrionMilvusClient,
        embedding_provider: EmbeddingProvider,
    ) -> None:
        self._milvus = milvus_client
        self._embedder = embedding_provider

    async def initialise(self) -> None:
        """Connect to Milvus and ensure collections exist."""
        await self._milvus.connect()
        await self._milvus.ensure_collections()
        logger.info("vector_memory_initialised")

    async def close(self) -> None:
        """Disconnect from Milvus."""
        await self._milvus.close()

    async def store_hook(
        self,
        hook_text: str,
        engagement_score: float,
        content_id: str,
    ) -> None:
        """Store a hook embedding with engagement metrics.

        Called after content approval to build the few-shot example bank.

        Args:
            hook_text: The hook text to embed and store.
            engagement_score: Engagement metric (0.0 - 1.0).
            content_id: ID of the content piece this hook belongs to.
        """
        embedding = await self._embedder.embed(hook_text)

        await self._milvus.insert_hook_embedding(
            embedding=embedding,
            hook_text=hook_text,
            engagement_score=engagement_score,
            content_id=content_id,
        )

        logger.info(
            "hook_stored",
            content_id=content_id,
            engagement_score=engagement_score,
        )

    async def store_content(
        self,
        script_text: str,
        content_id: str,
        created_at: str,
    ) -> None:
        """Store a content script embedding.

        Args:
            script_text: The full script text to embed and store.
            content_id: ID of the content piece.
            created_at: ISO-format timestamp of content creation.
        """
        embedding = await self._embedder.embed(script_text)

        await self._milvus.insert_content_embedding(
            embedding=embedding,
            script_text=script_text,
            content_id=content_id,
            created_at=created_at,
        )

        logger.info("content_embedding_stored", content_id=content_id)

    async def get_similar_hooks(
        self,
        query_text: str,
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """Query the top-K most similar past hooks for few-shot examples.

        Args:
            query_text: The trend topic or draft hook to find examples for.
            top_k: Number of similar hooks to return.

        Returns:
            List of dicts with hook_text, engagement_score, content_id,
            and distance keys. Returns an empty list if the collection
            is empty or Milvus is unavailable.
        """
        try:
            embedding = await self._embedder.embed(query_text)
            results = await self._milvus.search_similar_hooks(
                query_embedding=embedding,
                top_k=top_k,
            )
            logger.debug(
                "similar_hooks_queried",
                query_preview=query_text[:50],
                results_count=len(results),
            )
            return results
        except Exception:
            logger.exception("similar_hooks_query_failed")
            return []

    async def get_similar_content(
        self,
        query_text: str,
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """Query the top-K most similar past content scripts.

        Args:
            query_text: Text to search against.
            top_k: Number of similar results to return.

        Returns:
            List of dicts with script_text, content_id, created_at,
            and distance keys.
        """
        try:
            embedding = await self._embedder.embed(query_text)
            results = await self._milvus.search_similar_content(
                query_embedding=embedding,
                top_k=top_k,
            )
            return results
        except Exception:
            logger.exception("similar_content_query_failed")
            return []
