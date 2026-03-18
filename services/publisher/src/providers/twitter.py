"""X/Twitter social media provider using tweepy."""

from __future__ import annotations

import structlog
import tweepy

from src.providers.base import PublishContent, SocialProvider
from src.schemas import PublishResult

logger = structlog.get_logger(__name__)

TWEET_CHAR_LIMIT = 280


def format_tweet_text(
    text: str,
    hashtags: list[str] | None = None,
) -> str:
    """Format text for a tweet, respecting character limits.

    Args:
        text: The main content text.
        hashtags: Optional hashtags to append.

    Returns:
        Formatted tweet text within character limit.
    """
    if hashtags:
        tag_str = " ".join(hashtags)
        candidate = f"{text}\n\n{tag_str}"
        if len(candidate) <= TWEET_CHAR_LIMIT:
            return candidate
        # Try without hashtags if too long
        if len(text) <= TWEET_CHAR_LIMIT:
            return text

    if len(text) >= TWEET_CHAR_LIMIT:
        return text[: TWEET_CHAR_LIMIT - 1] + "…"

    return text


class TwitterProvider(SocialProvider):
    """X/Twitter provider using tweepy AsyncClient."""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        access_token: str,
        access_token_secret: str,
    ) -> None:
        self._api_key = api_key
        self._api_secret = api_secret
        self._access_token = access_token
        self._access_token_secret = access_token_secret

    def _get_client(self) -> tweepy.AsyncClient:
        return tweepy.AsyncClient(
            consumer_key=self._api_key,
            consumer_secret=self._api_secret,
            access_token=self._access_token,
            access_token_secret=self._access_token_secret,
        )

    async def publish(self, content: PublishContent) -> PublishResult:
        """Post a tweet with optional media."""
        try:
            client = self._get_client()
            tweet_text = format_tweet_text(content.text, content.hashtags)

            # TODO: Media upload requires v1.1 API — implement when needed
            response = await client.create_tweet(text=tweet_text)
            tweet_id = str(response.data["id"])

            logger.info(
                "tweet_published",
                tweet_id=tweet_id,
                text_length=len(tweet_text),
            )

            return PublishResult(
                platform="twitter",
                status="published",
                platform_post_id=tweet_id,
            )

        except Exception as exc:
            logger.error("tweet_publish_failed", error=str(exc))
            return PublishResult(
                platform="twitter",
                status="failed",
                error=str(exc),
            )

    async def validate_credentials(self) -> bool:
        """Verify the stored credentials work."""
        try:
            client = self._get_client()
            me = await client.get_me()
            return me.data is not None
        except Exception:
            return False

    def get_character_limit(self) -> int:
        return TWEET_CHAR_LIMIT

    def get_platform_name(self) -> str:
        return "twitter"
