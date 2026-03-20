# Scout Service

Monitors external sources (RSS, social media, news APIs) to detect trending topics and signals for content generation.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8001
```

## Responsibilities
- Poll configured data sources on a schedule
- Score and rank topics by relevance
- Emit `TrendDetected` events to the event bus

## Provider: Twitter/X

The Twitter provider (`src/providers/twitter.py`) is a **secondary verification layer** that cross-references trends detected by other sources (RSS, Google Trends) against X/Twitter activity.

**Configuration:** Set `TWITTER_BEARER_TOKEN` in your `.env` file. When the token is missing or empty the provider returns an empty list and Scout continues operating with its other sources.

**API tier requirement:** The provider uses `search_recent_tweets` which requires a Twitter API v2 **Basic** tier subscription ($100/month). The Free tier does not include search endpoints. See https://developer.x.com/en/docs/twitter-api for current pricing.
