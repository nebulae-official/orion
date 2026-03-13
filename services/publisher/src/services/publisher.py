"""Publishing workflow orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from orion_common.db.models import (
    Content,
    ContentStatus,
    PublishRecord,
    PublishStatus,
    SocialAccount,
)
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from src.exceptions import ContentNotApprovedError, ContentNotFoundError, SafetyCheckFailedError
from src.providers.base import PublishContent, SocialProvider
from src.providers.twitter import TwitterProvider
from src.schemas import PublishResponse, PublishResult
from src.services.crypto import decrypt_credentials
from src.services.safety import check_content_safety

logger = structlog.get_logger(__name__)


class PublishingService:
    """Orchestrates the content publishing workflow."""

    def __init__(self, session: AsyncSession, event_bus: EventBus | None) -> None:
        self.session = session
        self.event_bus = event_bus

    async def publish_content(
        self,
        content_id: UUID,
        platforms: list[str],
    ) -> PublishResponse:
        """Publish approved content to the specified platforms."""
        content = await self._get_content(content_id)

        if content.status.value != "approved":
            raise ContentNotApprovedError(
                f"Content must be in 'approved' status, got '{content.status.value}'"
            )

        text = content.script_body or content.title
        has_media = len(content.media_assets) > 0

        results: list[PublishResult] = []
        any_published = False

        for platform in platforms:
            provider = await self._get_provider(platform)
            if provider is None:
                results.append(
                    PublishResult(
                        platform=platform,
                        status="failed",
                        error=f"No active account for platform '{platform}'",
                    )
                )
                continue

            safety = await check_content_safety(
                text=text,
                has_media=has_media,
                platform_char_limit=provider.get_character_limit(),
            )
            if not safety.passed:
                raise SafetyCheckFailedError(violations=safety.violations)

            hashtags = []
            if content.trend and content.trend.raw_data:
                hashtags = [
                    f"#{kw}" for kw in content.trend.raw_data.get("keywords", [])[:3]
                ]

            publish_content = PublishContent(
                text=text,
                media_paths=[a.file_path for a in content.media_assets],
                hashtags=hashtags,
            )

            result = await provider.publish(publish_content)
            results.append(result)

            record = PublishRecord(
                content_id=content_id,
                platform=platform,
                platform_post_id=result.platform_post_id,
                status=PublishStatus(result.status),
                error_message=result.error,
                published_at=datetime.now(timezone.utc) if result.status == "published" else None,
            )
            self.session.add(record)

            if result.status == "published":
                any_published = True

        now = datetime.now(timezone.utc)
        if any_published:
            content.status = ContentStatus.published
            await self.session.flush()

            if self.event_bus:
                payload = {
                    "content_id": str(content_id),
                    "platforms": platforms,
                    "results": [r.model_dump() for r in results],
                    "published_at": now.isoformat(),
                }
                await self.event_bus.publish(Channels.CONTENT_PUBLISHED, payload)

        await self.session.commit()

        return PublishResponse(
            content_id=content_id,
            results=results,
            published_at=now if any_published else None,
        )

    async def _get_content(self, content_id: UUID) -> Content:
        stmt = (
            select(Content)
            .where(Content.id == content_id)
            .options(
                selectinload(Content.media_assets),
                selectinload(Content.trend),
            )
        )
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()
        if content is None:
            raise ContentNotFoundError(f"Content {content_id} not found")
        return content

    async def _get_provider(self, platform: str) -> SocialProvider | None:
        stmt = (
            select(SocialAccount)
            .where(SocialAccount.platform == platform, SocialAccount.is_active.is_(True))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        account = result.scalar_one_or_none()
        if account is None:
            return None

        creds = decrypt_credentials(account.credentials)

        if platform == "twitter":
            return TwitterProvider(
                api_key=creds["api_key"],
                api_secret=creds["api_secret"],
                access_token=creds["access_token"],
                access_token_secret=creds["access_token_secret"],
            )

        return None
