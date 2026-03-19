#!/usr/bin/env python3
"""Generate realistic dummy data fixtures for the Orion platform.

Outputs JSON files to scripts/fixtures/ for use by the dashboard demo mode,
the seed script, and CLI tooling.

Uses only Python stdlib (json, random, datetime, uuid).
"""

from __future__ import annotations

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = datetime.now(UTC)


def _id() -> str:
    return str(uuid.uuid4())


def _ts(days_ago: float = 0, hours_ago: float = 0) -> str:
    """Return an ISO-8601 timestamp relative to now."""
    dt = NOW - timedelta(days=days_ago, hours=hours_ago)
    return dt.isoformat()


def _score(low: float = 0.5, high: float = 0.99) -> float:
    return round(random.uniform(low, high), 3)


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------

TREND_TOPICS = [
    # Tech
    ("AI Agents Replace Junior Devs — Hype or Reality?", "tech", "google_trends"),
    ("Rust Adoption Surges in Enterprise Backend Systems", "tech", "rss"),
    ("Apple Vision Pro 2 Leak Sparks AR/VR Debate", "tech", "twitter"),
    ("Open-Source LLMs Close the Gap on GPT-5", "tech", "google_trends"),
    ("Kubernetes 1.32 Drops Docker Support Entirely", "tech", "rss"),
    ("WebAssembly Enters the Server-Side Mainstream", "tech", "twitter"),
    # Gaming
    ("GTA VI Trailer Breaks YouTube Record in 4 Hours", "gaming", "twitter"),
    ("Nintendo Switch 2 Specs Confirmed by FCC Filing", "gaming", "rss"),
    ("Indie Roguelike Tops Steam Charts for Third Week", "gaming", "google_trends"),
    ("Cloud Gaming Latency Finally Under 20ms on 5G", "gaming", "twitter"),
    ("Unreal Engine 6 Preview Stuns at GDC 2026", "gaming", "rss"),
    # Finance
    ("Fed Signals Rate Cut — Crypto Markets Rally", "finance", "google_trends"),
    ("Stripe Launches AI-Powered Fraud Detection Suite", "finance", "rss"),
    ("DeFi TVL Crosses $200B for First Time Since 2022", "finance", "twitter"),
    ("EU Digital Euro Pilot Begins in Five Countries", "finance", "google_trends"),
    ("Robinhood Adds Options Trading for Commodities", "finance", "rss"),
    ("BRICS Payment Network Gains Momentum", "finance", "twitter"),
    ("SEC Approves Spot Ethereum ETF Options", "finance", "google_trends"),
]

TREND_STATUSES = ["NEW", "USED", "DISCARDED"]


def generate_trends() -> list[dict]:
    trends = []
    for i, (topic, niche, source) in enumerate(TREND_TOPICS):
        keywords = topic.lower().split()[:4]
        status_weights = [0.4, 0.4, 0.2]
        trends.append(
            {
                "id": _id(),
                "topic": topic,
                "niche": niche,
                "virality_score": _score(0.5, 0.99),
                "score": None,  # legacy alias
                "source": source,
                "keywords": keywords,
                "status": random.choices(TREND_STATUSES, weights=status_weights, k=1)[0],
                "detected_at": _ts(days_ago=random.uniform(0, 14)),
                "created_at": _ts(days_ago=random.uniform(0, 14)),
            }
        )
    # Back-fill score as alias for virality_score
    for t in trends:
        t["score"] = t["virality_score"]
    return trends


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------

CONTENT_TITLES = [
    "Why AI Agents Are Changing Software Development Forever",
    "Rust vs Go in 2026: Which Backend Language Wins?",
    "The Apple Vision Pro 2 — Everything We Know",
    "Open-Source LLMs Are Catching Up Fast",
    "GTA VI: Why This Trailer Broke the Internet",
    "Nintendo Switch 2 Deep Dive: Specs, Games, Price",
    "The Fed Just Changed Everything for Crypto",
    "Stripe's New AI Fraud Detection Explained",
    "Cloud Gaming in 2026: Is It Finally Good?",
    "DeFi's Comeback: $200 Billion and Counting",
    "WebAssembly on the Server — The Future of Compute",
    "Indie Games Are Dominating Steam Right Now",
    "Kubernetes Without Docker: What You Need to Know",
    "Unreal Engine 6 Preview: Next-Gen Graphics",
    "The EU Digital Euro: What It Means for You",
]

STATUS_DISTRIBUTION: list[tuple[str, int]] = [
    ("draft", 2),
    ("generating", 2),
    ("review", 3),
    ("approved", 4),
    ("published", 2),
    ("rejected", 2),
]

SCRIPTS = [
    "In this video, we break down the latest developments and what they mean for the industry. Let's dive in.",
    "Hey everyone! Today we're covering a massive story that's been trending all week. Here's what you need to know.",
    "Welcome back to the channel. This topic has been blowing up online, and for good reason. Let me explain.",
]


def generate_content(trends: list[dict]) -> list[dict]:
    content = []
    title_idx = 0
    for status, count in STATUS_DISTRIBUTION:
        for _ in range(count):
            cid = _id()
            days = random.uniform(0, 10)
            item: dict = {
                "id": cid,
                "title": CONTENT_TITLES[title_idx % len(CONTENT_TITLES)],
                "body": f"Full article body for: {CONTENT_TITLES[title_idx % len(CONTENT_TITLES)]}",
                "status": status,
                "thumbnail_url": "/api/placeholder/640/360",
                "video_url": None,
                "script": random.choice(SCRIPTS) if status != "draft" else None,
                "confidence_score": _score(0.6, 0.95) if status not in ("draft",) else None,
                "trend_id": random.choice(trends)["id"] if trends else None,
                "created_at": _ts(days_ago=days),
                "updated_at": _ts(days_ago=days - random.uniform(0, 1)),
                "published_at": _ts(days_ago=random.uniform(0, 3))
                if status == "published"
                else None,
            }
            if status == "published":
                item["video_url"] = f"/api/placeholder/video/{cid}"
            content.append(item)
            title_idx += 1
    return content


# ---------------------------------------------------------------------------
# Media Assets
# ---------------------------------------------------------------------------

MEDIA_TYPES = ["image", "video", "audio"]


def generate_media_assets(content_items: list[dict]) -> list[dict]:
    assets = []
    # Pick content items that are past the draft stage
    eligible = [c for c in content_items if c["status"] not in ("draft",)]
    for c in eligible[:10]:
        media_type = random.choice(MEDIA_TYPES)
        asset: dict = {
            "id": _id(),
            "content_id": c["id"],
            "type": media_type,
            "url": f"/media/{media_type}s/{_id()[:8]}.{'mp4' if media_type == 'video' else 'mp3' if media_type == 'audio' else 'png'}",
            "duration": random.randint(15, 180) if media_type in ("video", "audio") else None,
            "width": 1920 if media_type != "audio" else None,
            "height": 1080 if media_type != "audio" else None,
            "file_size": random.randint(500_000, 50_000_000),
            "created_at": c["created_at"],
        }
        assets.append(asset)
    return assets


# ---------------------------------------------------------------------------
# Pipeline Runs
# ---------------------------------------------------------------------------

PIPELINE_STATUSES = [
    "completed",
    "completed",
    "completed",
    "running",
    "failed",
    "queued",
    "completed",
    "completed",
]


def generate_pipeline_runs(content_items: list[dict]) -> list[dict]:
    runs = []
    for i, status in enumerate(PIPELINE_STATUSES):
        cid = content_items[i % len(content_items)]["id"] if content_items else _id()
        started = NOW - timedelta(hours=random.uniform(1, 72))
        duration_s = random.randint(30, 600) if status in ("completed", "failed") else None
        runs.append(
            {
                "id": _id(),
                "content_id": cid,
                "status": status,
                "started_at": started.isoformat(),
                "completed_at": (started + timedelta(seconds=duration_s)).isoformat()
                if duration_s
                else None,
                "duration_seconds": duration_s,
                "stages_completed": random.randint(1, 6) if status != "queued" else 0,
                "stages_total": 6,
                "error": "Timeout waiting for image generation model"
                if status == "failed"
                else None,
            }
        )
    return runs


# ---------------------------------------------------------------------------
# Costs
# ---------------------------------------------------------------------------

PROVIDERS = ["ollama", "comfyui", "fal", "elevenlabs"]
CATEGORIES = ["inference", "image_generation", "video_generation", "tts", "embedding"]


def generate_costs() -> list[dict]:
    costs = []
    for provider in PROVIDERS:
        for day_offset in range(30):
            if random.random() < 0.3:
                continue  # skip some days for realism
            category = random.choice(CATEGORIES)
            amount = round(random.uniform(0.01, 8.50), 4)
            if provider == "ollama":
                amount = round(random.uniform(0.001, 0.05), 4)  # local is cheap
            elif provider == "elevenlabs":
                amount = round(random.uniform(0.10, 2.00), 4)
            costs.append(
                {
                    "id": _id(),
                    "provider": provider,
                    "category": category,
                    "amount": amount,
                    "currency": "USD",
                    "timestamp": _ts(days_ago=day_offset),
                    "content_id": _id(),
                }
            )
    return costs


# ---------------------------------------------------------------------------
# Metrics / Events (last 30 days)
# ---------------------------------------------------------------------------


def generate_metrics() -> dict:
    """Generate aggregated metric data suitable for the analytics dashboard."""
    # Funnel metrics
    generated = random.randint(40, 80)
    review = int(generated * random.uniform(0.6, 0.8))
    approved = int(review * random.uniform(0.5, 0.7))
    published = int(approved * random.uniform(0.6, 0.9))
    rejected = generated - approved - (generated - review)

    funnel = {
        "generated": generated,
        "review": review,
        "approved": approved,
        "published": published,
        "rejected": max(rejected, 2),
    }

    # Cost summary
    cost_records = generate_costs()
    total_cost = round(sum(c["amount"] for c in cost_records), 2)
    by_category: dict[str, float] = {}
    for c in cost_records:
        by_category[c["category"]] = round(by_category.get(c["category"], 0) + c["amount"], 4)

    cost_summary = {
        "total_cost": total_cost,
        "by_category": by_category,
        "record_count": len(cost_records),
    }

    # Provider cost breakdown
    provider_costs: dict[str, dict] = {}
    for c in cost_records:
        if c["provider"] not in provider_costs:
            provider_costs[c["provider"]] = {
                "provider": c["provider"],
                "total_cost": 0.0,
                "by_category": {},
            }
        provider_costs[c["provider"]]["total_cost"] = round(
            provider_costs[c["provider"]]["total_cost"] + c["amount"], 4
        )
        cat = c["category"]
        provider_costs[c["provider"]]["by_category"][cat] = round(
            provider_costs[c["provider"]]["by_category"].get(cat, 0) + c["amount"], 4
        )
    provider_cost_list = list(provider_costs.values())

    # Error trend (hourly for last 7 days)
    error_trend = []
    for h in range(168):
        total_count = random.randint(5, 30)
        error_count = random.randint(0, max(1, int(total_count * 0.15)))
        error_trend.append(
            {
                "timestamp": _ts(hours_ago=h),
                "error_count": error_count,
                "total_count": total_count,
                "error_rate": round(error_count / total_count, 4) if total_count else 0,
            }
        )

    return {
        "funnel": funnel,
        "cost_summary": cost_summary,
        "provider_costs": provider_cost_list,
        "error_trend": error_trend,
    }


# ---------------------------------------------------------------------------
# Publishing History
# ---------------------------------------------------------------------------

PLATFORMS = ["youtube", "tiktok", "instagram", "twitter"]


def generate_publishing_history(content_items: list[dict]) -> list[dict]:
    published = [c for c in content_items if c["status"] == "published"]
    records = []
    for c in published:
        for platform in random.sample(PLATFORMS, k=random.randint(1, 3)):
            status = random.choices(
                ["published", "pending", "failed"], weights=[0.7, 0.2, 0.1], k=1
            )[0]
            records.append(
                {
                    "id": _id(),
                    "content_id": c["id"],
                    "platform": platform,
                    "platform_post_id": _id()[:12] if status == "published" else None,
                    "status": status,
                    "error_message": "Rate limit exceeded" if status == "failed" else None,
                    "published_at": _ts(days_ago=random.uniform(0, 5))
                    if status == "published"
                    else None,
                    "created_at": c["created_at"],
                }
            )
    # Add a few extra records from non-published content for variety
    approved = [c for c in content_items if c["status"] == "approved"]
    for c in approved[:2]:
        records.append(
            {
                "id": _id(),
                "content_id": c["id"],
                "platform": random.choice(PLATFORMS),
                "platform_post_id": None,
                "status": "pending",
                "error_message": None,
                "published_at": None,
                "created_at": c["created_at"],
            }
        )
    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def write_fixture(name: str, data: object) -> None:
    path = FIXTURES_DIR / f"{name}.json"
    path.write_text(json.dumps(data, indent=2, default=str))
    print(f"  {path.relative_to(FIXTURES_DIR.parent)} ({path.stat().st_size:,} bytes)")


def main() -> None:
    random.seed(42)  # deterministic for reproducibility
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating Orion demo fixtures...")

    trends = generate_trends()
    write_fixture("trends", trends)

    content = generate_content(trends)
    write_fixture("content", content)

    media_assets = generate_media_assets(content)
    write_fixture("media_assets", media_assets)

    pipeline_runs = generate_pipeline_runs(content)
    write_fixture("pipeline_runs", pipeline_runs)

    costs = generate_costs()
    write_fixture("costs", costs)

    metrics = generate_metrics()
    write_fixture("metrics", metrics)

    publishing_history = generate_publishing_history(content)
    write_fixture("publishing_history", publishing_history)

    print(
        f"\nDone! {len(trends)} trends, {len(content)} content items, "
        f"{len(media_assets)} media assets, {len(pipeline_runs)} pipeline runs, "
        f"{len(costs)} cost records, {len(publishing_history)} publish records."
    )
    print(f"Fixtures written to {FIXTURES_DIR}/")


if __name__ == "__main__":
    main()
