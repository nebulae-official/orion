"""Pydantic request/response schemas for the Media service API."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class GenerateImageRequest(BaseModel):
    """Request body for single image generation."""

    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    steps: int = 20
    cfg_scale: float = 7.0
    seed: int | None = None
    content_id: uuid.UUID | None = None


class GenerateImageResponse(BaseModel):
    """Response body for single image generation."""

    file_path: str
    provider: str
    width: int
    height: int
    metadata: dict | None = None
    asset_id: uuid.UUID | None = None


class BatchGenerateRequest(BaseModel):
    """Request body for batch image generation."""

    content_id: uuid.UUID
    prompts: list[GenerateImageRequest] = Field(min_length=1)


class BatchGenerateResponse(BaseModel):
    """Response body for batch image generation."""

    content_id: uuid.UUID
    succeeded: int
    failed_count: int
    results: list[GenerateImageResponse]
    errors: list[str]


class ProviderStatus(BaseModel):
    """Status of a single provider."""

    name: str
    available: bool


class ProvidersResponse(BaseModel):
    """Response listing all providers and their availability."""

    providers: list[ProviderStatus]


class MediaAssetResponse(BaseModel):
    """Serialised representation of a persisted media asset."""

    id: uuid.UUID
    content_id: uuid.UUID
    asset_type: str
    provider: str
    file_path: str
    metadata: dict | None = None
    created_at: str
