"""Pydantic request/response schemas for the Scout service API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TrendResponse(BaseModel):
    """Single trend in API responses."""

    id: uuid.UUID
    topic: str
    source: str
    score: float
    raw_data: dict[str, Any] | None = None
    detected_at: datetime
    expired_at: datetime | None = None
    status: str

    model_config = {"from_attributes": True}


class TrendListResponse(BaseModel):
    """Paginated list of trends."""

    items: list[TrendResponse]
    total: int
    page: int
    page_size: int


class TriggerScanRequest(BaseModel):
    """Request body for triggering a manual trend scan."""

    region: str = Field(default="US", description="Geographic region code")
    limit: int = Field(default=20, ge=1, le=100, description="Max trends per provider")
    niche: str | None = Field(
        default=None,
        description="Niche config name (tech, gaming, finance, health)",
    )


class NicheConfigRequest(BaseModel):
    """Request body for custom niche configuration."""

    keywords: list[str] = Field(default_factory=list)
    excluded_topics: list[str] = Field(default_factory=list)
    min_score: float = Field(default=10.0, ge=0.0, le=100.0)
    categories: list[str] = Field(default_factory=list)


class NicheConfigResponse(BaseModel):
    """Response showing available niche configs."""

    active_niche: str | None
    available_niches: list[str]
    config: NicheConfigRequest | None = None


class ScanResultResponse(BaseModel):
    """Response for a manual scan trigger."""

    message: str
    trends_found: int
    trends_saved: int
