# MILESTONE.md — Orion Product Milestones

> This file is read by the Analyst agent every nightly run.
> Only findings that BLOCK the current milestone are reported as critical/high.
> Everything else is tagged `deferred` and logged but not actioned.

---

## 🎯 Current Milestone: Tier 1 — MVP

**Goal:** A user can go from sign-up to published content without touching anything.

**Target Date:** April 30, 2026

**The Flow That Must Work:**
```
User signs up → configures niche + API keys →
Scout detects trend → Director writes script →
Media generates images → Editor assembles video with TTS →
Publisher posts to Twitter → User sees it on dashboard with cost
```

### Acceptance Criteria

#### Auth & Onboarding
- [ ] User can sign up via OAuth (GitHub/Google)
- [ ] User can configure API keys from dashboard (stored encrypted server-side)
- [ ] User can select a niche from dashboard
- [ ] User can configure target platform (Twitter initially)

#### Scout (Trend Detection)
- [x] Google Trends provider working
- [x] RSS provider working
- [ ] Twitter/X provider working with real API key
- [ ] Trends flow into database with deduplication
- [ ] Niche filter correctly scopes trends
- [ ] TREND_DETECTED event fires and Director receives it

#### Director (Content Creation)
- [ ] LangGraph pipeline runs end-to-end on a real trend
- [ ] Analyst agent analyzes the trend
- [ ] ScriptGenerator produces a complete script with narration text
- [ ] VisualPrompter generates image prompts for each scene
- [ ] CritiqueAgent validates quality
- [ ] CONTENT_CREATED event fires with script + visual prompts
- [ ] Content stored in database with full metadata

#### Media (Image/Video Generation)
- [ ] Fal.ai image provider generates images from visual prompts
- [ ] Batch generation works (multiple images per content piece)
- [ ] Images stored/accessible for Editor
- [ ] MEDIA_GENERATED event fires with image references
- [ ] Fallback handling works when generation fails

#### Editor (Video Assembly)
- [ ] TTS narration from script text (FishSpeech or ElevenLabs)
- [ ] Audio + images assembled into video
- [ ] Captions/subtitles burned in
- [ ] Final video file produced and stored
- [ ] CONTENT_PUBLISHED event fires with video reference

#### Publisher (Social Posting)
- [ ] Twitter API integration works with real credentials
- [ ] Video uploaded and posted to Twitter
- [ ] Post URL captured and stored
- [ ] Status updated in database

#### Dashboard (User Visibility)
- [ ] Trend feed page shows detected trends
- [ ] Pipeline page shows content moving through stages
- [ ] Content detail page shows script, images, video, publish status
- [ ] Cost tracking page shows per-content and per-service costs
- [ ] Settings page for API keys actually persists to backend
- [ ] Settings page for provider selection works
- [ ] Real-time notifications via WebSocket

#### Infrastructure
- [x] Gateway auth (JWT + OAuth) working
- [x] Redis event bus wired across services
- [x] PostgreSQL with migrations
- [ ] All services start and pass health checks via Docker Compose
- [ ] Cost tracking receives real data from events
- [x] Notification system working

### What I Need From Gishant
- [ ] Twitter API credentials (API key, secret, access token, bearer token)
- [ ] Fal.ai API key
- [ ] ElevenLabs API key OR decision to use FishSpeech (free, local)
- [ ] OpenAI or Anthropic API key for Director LLM
- [ ] First niche to target (suggest: tech/AI news — your domain expertise)
- [ ] Twitter account to publish to (test account recommended)

---

## Tier 2 — Product (After MVP)

> Do NOT work on these until Tier 1 is complete.

- [ ] Multiple platform publishing (YouTube Shorts, TikTok, Instagram Reels)
- [ ] Content scheduling (publish at optimal times)
- [ ] Content queue with approval/rejection flow
- [ ] Multi-niche support (switch between niches)
- [ ] Usage analytics and engagement tracking
- [ ] Multi-user with proper data isolation
- [ ] Automated content scheduling (daily cadence)
- [ ] ComfyUI local image generation as alternative to Fal.ai

---

## Tier 3 — Scale (After Product)

> Long-term vision. Not actionable yet.

- [ ] Local LLM support (Ollama) alongside cloud
- [ ] White-label capability for agencies
- [ ] A/B testing content styles
- [ ] Engagement-driven optimization (learn what performs)
- [ ] Team roles and permissions
- [ ] Billing and subscription management
- [ ] Public API for third-party integrations

---

## Agent Instructions

### For the Analyst
1. Read this file FIRST before scanning the codebase
2. Only report findings that block unchecked Tier 1 items as critical/high
3. Tag all Tier 2/3 findings as `deferred:tier2` or `deferred:tier3`
4. When all Tier 1 criteria are checked, report: "MVP READY — all acceptance criteria met"

### For the Judge
1. Prioritize decisions that move Tier 1 checkboxes from [ ] to [x]
2. Reject any proposals that scope-creep into Tier 2 features
3. When evaluating tradeoffs, always ask: "Does this help ship MVP?"

### For the Sprint Planner
1. Order tasks by which Tier 1 checkbox they unblock
2. Group related checkboxes into single tasks where possible
3. Highlight what Gishant needs to provide (API keys, credentials, decisions)

---

_Last updated: 2026-03-22 by Andromeda_
_Review this file whenever priorities change._
