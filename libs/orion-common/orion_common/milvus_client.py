"""Async Milvus vector database client for Orion services."""

from __future__ import annotations

from typing import Any

import structlog
from pymilvus import (
    Collection,
    CollectionSchema,
    DataType,
    FieldSchema,
    MilvusClient,
    connections,
    utility,
)

from orion_common.config import get_settings

logger = structlog.get_logger(__name__)

# Collection definitions
HOOK_EMBEDDINGS_COLLECTION = "hook_embeddings"
CONTENT_EMBEDDINGS_COLLECTION = "content_embeddings"

# Embedding dimension (OpenAI-compatible 1536d)
EMBEDDING_DIM = 1536


def _hook_embeddings_schema() -> CollectionSchema:
    """Return the schema for the hook_embeddings collection."""
    fields = [
        FieldSchema(
            name="id",
            dtype=DataType.INT64,
            is_primary=True,
            auto_id=True,
        ),
        FieldSchema(
            name="embedding",
            dtype=DataType.FLOAT_VECTOR,
            dim=EMBEDDING_DIM,
        ),
        FieldSchema(
            name="hook_text",
            dtype=DataType.VARCHAR,
            max_length=2048,
        ),
        FieldSchema(
            name="engagement_score",
            dtype=DataType.FLOAT,
        ),
        FieldSchema(
            name="content_id",
            dtype=DataType.VARCHAR,
            max_length=64,
        ),
    ]
    return CollectionSchema(
        fields=fields,
        description="Hook text embeddings with engagement metrics",
    )


def _content_embeddings_schema() -> CollectionSchema:
    """Return the schema for the content_embeddings collection."""
    fields = [
        FieldSchema(
            name="id",
            dtype=DataType.INT64,
            is_primary=True,
            auto_id=True,
        ),
        FieldSchema(
            name="embedding",
            dtype=DataType.FLOAT_VECTOR,
            dim=EMBEDDING_DIM,
        ),
        FieldSchema(
            name="script_text",
            dtype=DataType.VARCHAR,
            max_length=8192,
        ),
        FieldSchema(
            name="content_id",
            dtype=DataType.VARCHAR,
            max_length=64,
        ),
        FieldSchema(
            name="created_at",
            dtype=DataType.VARCHAR,
            max_length=64,
        ),
    ]
    return CollectionSchema(
        fields=fields,
        description="Content script embeddings for similarity search",
    )


class OrionMilvusClient:
    """Async-friendly wrapper around pymilvus for Orion vector operations.

    Manages connections, collection creation, and CRUD operations
    for the ``hook_embeddings`` and ``content_embeddings`` collections.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        alias: str = "default",
    ) -> None:
        settings = get_settings()
        self._host = host or settings.milvus_host
        self._port = port or settings.milvus_port
        self._alias = alias
        self._connected = False

    async def connect(self) -> None:
        """Establish connection to the Milvus server."""
        if self._connected:
            return

        connections.connect(
            alias=self._alias,
            host=self._host,
            port=self._port,
        )
        self._connected = True
        logger.info(
            "milvus_connected",
            host=self._host,
            port=self._port,
        )

    async def close(self) -> None:
        """Disconnect from the Milvus server."""
        if self._connected:
            connections.disconnect(alias=self._alias)
            self._connected = False
            logger.info("milvus_disconnected")

    async def ensure_collections(self) -> None:
        """Create collections and indexes if they do not already exist."""
        await self.connect()

        # Hook embeddings collection
        if not utility.has_collection(HOOK_EMBEDDINGS_COLLECTION):
            schema = _hook_embeddings_schema()
            collection = Collection(
                name=HOOK_EMBEDDINGS_COLLECTION,
                schema=schema,
            )
            collection.create_index(
                field_name="embedding",
                index_params={
                    "metric_type": "COSINE",
                    "index_type": "IVF_FLAT",
                    "params": {"nlist": 128},
                },
            )
            logger.info(
                "collection_created",
                collection=HOOK_EMBEDDINGS_COLLECTION,
            )

        # Content embeddings collection
        if not utility.has_collection(CONTENT_EMBEDDINGS_COLLECTION):
            schema = _content_embeddings_schema()
            collection = Collection(
                name=CONTENT_EMBEDDINGS_COLLECTION,
                schema=schema,
            )
            collection.create_index(
                field_name="embedding",
                index_params={
                    "metric_type": "COSINE",
                    "index_type": "IVF_FLAT",
                    "params": {"nlist": 128},
                },
            )
            logger.info(
                "collection_created",
                collection=CONTENT_EMBEDDINGS_COLLECTION,
            )

    async def insert_hook_embedding(
        self,
        embedding: list[float],
        hook_text: str,
        engagement_score: float,
        content_id: str,
    ) -> None:
        """Insert a hook embedding into the hook_embeddings collection."""
        await self.connect()
        collection = Collection(HOOK_EMBEDDINGS_COLLECTION)
        collection.insert([
            [embedding],
            [hook_text],
            [engagement_score],
            [content_id],
        ])
        collection.flush()
        logger.debug(
            "hook_embedding_inserted",
            content_id=content_id,
        )

    async def insert_content_embedding(
        self,
        embedding: list[float],
        script_text: str,
        content_id: str,
        created_at: str,
    ) -> None:
        """Insert a content embedding into the content_embeddings collection."""
        await self.connect()
        collection = Collection(CONTENT_EMBEDDINGS_COLLECTION)
        collection.insert([
            [embedding],
            [script_text],
            [content_id],
            [created_at],
        ])
        collection.flush()
        logger.debug(
            "content_embedding_inserted",
            content_id=content_id,
        )

    async def search_similar_hooks(
        self,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """Search for similar hooks by embedding vector.

        Args:
            query_embedding: The embedding vector to search against.
            top_k: Number of results to return.

        Returns:
            List of dicts with hook_text, engagement_score, content_id, distance.
        """
        await self.connect()
        collection = Collection(HOOK_EMBEDDINGS_COLLECTION)
        collection.load()

        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param={
                "metric_type": "COSINE",
                "params": {"nprobe": 16},
            },
            limit=top_k,
            output_fields=["hook_text", "engagement_score", "content_id"],
        )

        hits: list[dict[str, Any]] = []
        for hit in results[0]:
            hits.append({
                "hook_text": hit.entity.get("hook_text"),
                "engagement_score": hit.entity.get("engagement_score"),
                "content_id": hit.entity.get("content_id"),
                "distance": hit.distance,
            })

        logger.debug(
            "similar_hooks_found",
            count=len(hits),
            top_k=top_k,
        )
        return hits

    async def search_similar_content(
        self,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """Search for similar content by embedding vector.

        Args:
            query_embedding: The embedding vector to search against.
            top_k: Number of results to return.

        Returns:
            List of dicts with script_text, content_id, created_at, distance.
        """
        await self.connect()
        collection = Collection(CONTENT_EMBEDDINGS_COLLECTION)
        collection.load()

        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param={
                "metric_type": "COSINE",
                "params": {"nprobe": 16},
            },
            limit=top_k,
            output_fields=["script_text", "content_id", "created_at"],
        )

        hits: list[dict[str, Any]] = []
        for hit in results[0]:
            hits.append({
                "script_text": hit.entity.get("script_text"),
                "content_id": hit.entity.get("content_id"),
                "created_at": hit.entity.get("created_at"),
                "distance": hit.distance,
            })

        logger.debug(
            "similar_content_found",
            count=len(hits),
            top_k=top_k,
        )
        return hits


async def get_milvus_client() -> OrionMilvusClient:
    """Create and return a connected Milvus client from global settings."""
    client = OrionMilvusClient()
    await client.connect()
    return client
