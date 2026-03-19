"""Tests for the publishing workflow."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from src.exceptions import ContentNotApprovedError, SafetyCheckFailedError
from src.schemas import PublishResult, SafetyCheckResult
from src.services.publisher import PublishingService


@pytest.mark.asyncio
async def test_publish_rejects_non_approved():
    svc = PublishingService(session=AsyncMock(), event_bus=None)

    mock_content = AsyncMock()
    mock_content.status.value = "draft"

    with patch.object(svc, "_get_content", return_value=mock_content):
        with pytest.raises(ContentNotApprovedError, match="must be in 'approved' status"):
            await svc.publish_content(uuid4(), ["twitter"])


@pytest.mark.asyncio
async def test_publish_rejects_on_safety_failure():
    svc = PublishingService(session=AsyncMock(), event_bus=None)

    mock_content = AsyncMock()
    mock_content.status.value = "approved"
    mock_content.script_body = "bad content"
    mock_content.media_assets = []

    with (
        patch.object(svc, "_get_content", return_value=mock_content),
        patch(
            "src.services.publisher.check_content_safety",
            return_value=SafetyCheckResult(passed=False, violations=["blocked word"]),
        ),
    ):
        with pytest.raises(SafetyCheckFailedError, match="Safety check failed"):
            await svc.publish_content(uuid4(), ["twitter"])


@pytest.mark.asyncio
async def test_publish_success():
    mock_session = AsyncMock()
    svc = PublishingService(session=mock_session, event_bus=AsyncMock())

    mock_content = AsyncMock()
    mock_content.id = uuid4()
    mock_content.status.value = "approved"
    mock_content.script_body = "Test content for publishing"
    mock_content.media_assets = []
    mock_content.trend = AsyncMock()
    mock_content.trend.raw_data = {"keywords": ["test"]}

    mock_provider = AsyncMock()
    mock_provider.get_character_limit.return_value = 280
    mock_provider.get_platform_name.return_value = "twitter"
    mock_provider.publish.return_value = PublishResult(platform="twitter", status="published", platform_post_id="123")

    with (
        patch.object(svc, "_get_content", return_value=mock_content),
        patch(
            "src.services.publisher.check_content_safety",
            return_value=SafetyCheckResult(passed=True),
        ),
        patch.object(svc, "_get_provider", return_value=mock_provider),
    ):
        response = await svc.publish_content(mock_content.id, ["twitter"])

    assert len(response.results) == 1
    assert response.results[0].status == "published"
