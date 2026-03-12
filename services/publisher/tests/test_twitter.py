"""Tests for X/Twitter provider."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.providers.twitter import TwitterProvider, format_tweet_text


def test_format_tweet_text_under_limit():
    result = format_tweet_text("Hello world", hashtags=["#test"])
    assert result == "Hello world\n\n#test"


def test_format_tweet_text_over_limit():
    long_text = "a" * 280
    result = format_tweet_text(long_text)
    assert len(result) <= 280
    assert result.endswith("…")


def test_format_tweet_text_hashtags_trimmed_if_no_space():
    text = "a" * 270
    result = format_tweet_text(text, hashtags=["#longhashtag"])
    assert "#longhashtag" not in result
    assert len(result) <= 280


def test_character_limit():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )
    assert provider.get_character_limit() == 280


def test_platform_name():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )
    assert provider.get_platform_name() == "twitter"


@pytest.mark.asyncio
async def test_publish_success():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )

    mock_response = MagicMock()
    mock_response.data = {"id": "12345"}

    with patch.object(provider, "_get_client") as mock_client_fn:
        mock_client = AsyncMock()
        mock_client.create_tweet = AsyncMock(return_value=mock_response)
        mock_client_fn.return_value = mock_client

        from src.providers.base import PublishContent

        content = PublishContent(text="Test tweet")
        result = await provider.publish(content)

        assert result.status == "published"
        assert result.platform_post_id == "12345"
        assert result.platform == "twitter"
