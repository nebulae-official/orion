"""Image generation API routes."""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import AssetType
from orion_common.db.session import get_session

from ..providers.base import ImageProvider, ImageRequest
from ..repositories.asset_repo import MediaAssetRepository
from ..schemas import (
    BatchGenerateRequest,
    BatchGenerateResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    MediaAssetResponse,
    ProviderStatus,
    ProvidersResponse,
)
from ..services.batch_generator import BatchGenerator, BatchImageRequest

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/media", tags=["media"])

# These will be set during app startup via `configure_router`.
_provider: ImageProvider | None = None
_batch_generator: BatchGenerator | None = None


def configure_router(
    provider: ImageProvider, batch_generator: BatchGenerator
) -> None:
    """Inject runtime dependencies into the router module."""
    global _provider, _batch_generator  # noqa: PLW0603
    _provider = provider
    _batch_generator = batch_generator


def _get_provider() -> ImageProvider:
    if _provider is None:
        raise RuntimeError("Image provider not initialised")
    return _provider


def _get_batch_generator() -> BatchGenerator:
    if _batch_generator is None:
        raise RuntimeError("Batch generator not initialised")
    return _batch_generator


@router.post("/generate", response_model=GenerateImageResponse)
async def generate_image(
    body: GenerateImageRequest,
    session: AsyncSession = Depends(get_session),
) -> GenerateImageResponse:
    """Generate a single image from a text prompt."""
    provider = _get_provider()
    request = ImageRequest(
        prompt=body.prompt,
        negative_prompt=body.negative_prompt,
        width=body.width,
        height=body.height,
        steps=body.steps,
        cfg_scale=body.cfg_scale,
        seed=body.seed,
    )

    try:
        result = await provider.generate(request)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    asset_id: uuid.UUID | None = None
    if body.content_id is not None:
        repo = MediaAssetRepository(session)
        asset = await repo.create(
            content_id=body.content_id,
            asset_type=AssetType.image,
            provider=result.provider,
            file_path=result.file_path,
            metadata=result.metadata,
        )
        asset_id = asset.id

    return GenerateImageResponse(
        file_path=result.file_path,
        provider=result.provider,
        width=result.width,
        height=result.height,
        metadata=result.metadata,
        asset_id=asset_id,
    )


@router.post("/batch", response_model=BatchGenerateResponse)
async def generate_batch(
    body: BatchGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> BatchGenerateResponse:
    """Generate a batch of images for a content piece."""
    batch_gen = _get_batch_generator()

    prompts = [
        ImageRequest(
            prompt=p.prompt,
            negative_prompt=p.negative_prompt,
            width=p.width,
            height=p.height,
            steps=p.steps,
            cfg_scale=p.cfg_scale,
            seed=p.seed,
        )
        for p in body.prompts
    ]

    batch_request = BatchImageRequest(
        content_id=body.content_id,
        prompts=prompts,
    )

    batch_result = await batch_gen.generate_batch(batch_request)

    # Persist successful results
    repo = MediaAssetRepository(session)
    responses: list[GenerateImageResponse] = []
    for r in batch_result.results:
        asset = await repo.create(
            content_id=body.content_id,
            asset_type=AssetType.image,
            provider=r.provider,
            file_path=r.file_path,
            metadata=r.metadata,
        )
        responses.append(
            GenerateImageResponse(
                file_path=r.file_path,
                provider=r.provider,
                width=r.width,
                height=r.height,
                metadata=r.metadata,
                asset_id=asset.id,
            )
        )

    return BatchGenerateResponse(
        content_id=body.content_id,
        succeeded=len(responses),
        failed_count=len(batch_result.failed),
        results=responses,
        errors=batch_result.failed,
    )


@router.get("/assets/{content_id}", response_model=list[MediaAssetResponse])
async def get_assets_for_content(
    content_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[MediaAssetResponse]:
    """Retrieve all media assets for a given content piece."""
    repo = MediaAssetRepository(session)
    assets = await repo.get_by_content_id(content_id)
    return [
        MediaAssetResponse(
            id=a.id,
            content_id=a.content_id,
            asset_type=a.asset_type.value,
            provider=a.provider,
            file_path=a.file_path,
            metadata=a.metadata_,
            created_at=a.created_at.isoformat(),
        )
        for a in assets
    ]


@router.get("/providers", response_model=ProvidersResponse)
async def list_providers() -> ProvidersResponse:
    """List all configured providers and their availability status."""
    provider = _get_provider()

    # If the top-level provider is a FallbackImageProvider, inspect children
    from ..providers.fallback import FallbackImageProvider

    statuses: list[ProviderStatus] = []
    if isinstance(provider, FallbackImageProvider):
        for p in provider._providers:
            available = await p.is_available()
            statuses.append(
                ProviderStatus(
                    name=type(p).__name__,
                    available=available,
                )
            )
    else:
        available = await provider.is_available()
        statuses.append(
            ProviderStatus(
                name=type(provider).__name__,
                available=available,
            )
        )

    return ProvidersResponse(providers=statuses)
