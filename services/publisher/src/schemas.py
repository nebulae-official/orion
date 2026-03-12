"""Pydantic schemas for the Publisher service."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PublishRequest(BaseModel):
    """Request to publish content to one or more platforms."""

    content_id: UUID
    platforms: list[str] = Field(min_length=1)


class PublishResult(BaseModel):
    """Result of a single platform publish attempt."""

    platform: str
    status: str  # "published" or "failed"
    platform_post_id: str | None = None
    error: str | None = None


class PublishResponse(BaseModel):
    """Response from publishing content."""

    content_id: UUID
    results: list[PublishResult]
    published_at: datetime | None = None


class PublishRecordResponse(BaseModel):
    """A publish history record."""

    id: UUID
    content_id: UUID
    platform: str
    platform_post_id: str | None
    status: str
    error_message: str | None
    published_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialAccountCreate(BaseModel):
    """Request to add a social account."""

    platform: str
    display_name: str
    credentials: dict[str, str]


class SocialAccountResponse(BaseModel):
    """A social account (credentials redacted)."""

    id: UUID
    platform: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SafetyCheckResult(BaseModel):
    """Result of a content safety check."""

    passed: bool
    violations: list[str] = Field(default_factory=list)
