# MILESTONE.md — Orion Product Milestones

> This file is read by the Analyst agent every nightly run.
> Only findings that BLOCK the current milestone are reported as critical/high.
> Everything else is tagged `deferred` and logged but not actioned.

---

## 🎯 Current Milestone: Tier 1 — Content Generation MVP

**Goal:** Gishant can trigger an automated pipeline that turns a detected trend into a finished, publishable short-form video — end-to-end, no manual steps between trend detection and the final rendered MP4.

**Target Date:** June 30, 2026

**The Flow That Must Work:**
```
Scout (Google Trends + RSS) detects trend →
Director (NVIDIA NIM Llama, free) writes script + visual prompts →
Media (NVIDIA NIM Flux / free image provider) generates images per scene →
Editor (NVIDIA NIM Magpie TTS + ffmpeg pipeline) assembles locked-format short →
Output stored, dashboard shows preview, manual approval gates publish
```

**Provider strategy:** Tier 1 runs on **free providers only**. Once the pipeline is proven end-to-end, we swap in paid providers (Anthropic, Fal.ai, ElevenLabs) for quality — that swap is itself the architecture validation test for the Provider + Identity services.

---

### Locked Output Format (the contract)

Every video Orion produces must conform to this spec. The Director writes to it; the Editor renders to it. No deviation in Tier 1.

| Property | Value |
|---|---|
| Aspect ratio | 9:16 vertical |
| Resolution | 1080×1920 |
| Duration | 40–55 seconds |
| Hook scene | 3s, large overlay text + image |
| Body scenes | 4–5 scenes, ~8s each, image + voiceover |
| CTA scene | 3s, fixed copy + brand mark |
| Voiceover | NVIDIA NIM Magpie TTS (riva gRPC); FishSpeech as offline fallback adapter |
| Captions | Burned-in, Whisper-aligned to audio |
| Music | Optional ambient bed (Tier 1.5) |
| Output | MP4, H.264 video, AAC audio |

The Director outputs JSON matching this schema. If schema validation fails, the pipeline rejects the content **before** any image generation runs. This is the cost gate.

---

### Audit-Identified Gaps (sequenced fix list — 2026-05-02)

These are the concrete, evidence-based fixes from `docs/TIER1_AUDIT_2026-05-02.md`. They are the literal worklist to ship Tier 1. Order matters — items are sequenced by dependency.

- [ ] **#1 — Validator duration constants.** `services/editor/src/video/validator.py:20-21` enforces 55–60s; spec is 40–55s. Change `MIN_DURATION_SECS = 40.0`, `MAX_DURATION_SECS = 55.0`. (Fix: S, one line)
- [ ] **#2 — Director auto-trigger.** Set `DIRECTOR_AUTO_TRIGGER=true` in `.env` and `deploy/docker-compose.yml` director service env. Without it, Scout fires events into a void. (Fix: S, config)
- [x] **#3 — Provider route adapter factory.** Replace hardcoded `NvidiaNimXxxAdapter(entry)` in `services/provider/src/routes/{llm,image,tts}.py` with a registry lookup keyed by `entry.provider`. **This is the architecture validation gate** — until this lands, "swap a provider with zero code changes" is false. (Fix: M, ~10 lines per route + registry module)
- [ ] **#4 — TTS spec resolved as NIM Magpie primary, FishSpeech fallback.** Update MILESTONE locked-format (done above). Register FishSpeech as a Provider service adapter under `services/provider/src/adapters/tts/fish_speech.py` once #3 lands. Remove the unused factory branch in `editor/src/providers/factory.py`. (Fix: M)
- [ ] **#5 — HuggingFace image adapter.** Build under `services/provider/src/adapters/image/huggingface.py`, register in catalog. (Fix: M)
- [ ] **#6 — Pollinations image adapter.** Build under `services/provider/src/adapters/image/pollinations.py`, register in catalog. (Fix: M)
- [x] **#7 — Scene-count cost gate.** In Director, after `VisualPrompter` returns, validate `1 hook + 4–5 body + 1 CTA`. Reject content **before** CONTENT_CREATED fires if violated. Wire as a Pydantic model with `validator` decorators or an explicit guard in `pipeline.py`. (Fix: M)
- [x] **#8 — Dashboard API keys panel wiring.** `dashboard/src/components/settings/settings-api-keys-panel.tsx` renders static demo rows. Replace with the existing `api-keys-config.tsx` component + `saveApiKey` server action that's already wired. Update seed providers to NVIDIA NIM, Hugging Face (Tier 1 free stack), not Anthropic/Fal.ai/ElevenLabs. (Fix: M)
- [ ] **#9 — CONTENT_READY event.** Rename `CONTENT_UPDATED` → `CONTENT_READY` in `libs/orion-common/orion_common/events.py`. Update Editor `render_pipeline.py:228`. Update any Pulse / Dashboard subscribers. (Fix: S)
- [ ] **#10 — Cost provider string.** `services/director/src/services/pipeline.py:245` hardcodes `provider="ollama"`. Change to `"nvidia_nim"`. (Fix: S)
- [ ] **#11 — Dead Twitter/Fal.ai code.** Remove `TwitterProvider` instantiation from `services/scout/src/main.py:38-43`. Remove dead `request_fal_api_key` injection block in `services/media/src/main.py:59-68`. (Fix: S)
- [x] **#12 — Object storage.** Images and audio land in `/tmp/orion/...`. Across Docker containers, Editor cannot read Media's outputs. Add either (a) shared bind-mount volume in compose, or (b) MinIO container + S3 client in shared lib. **Recommendation: bind-mount for Tier 1 (faster), MinIO for Tier 2.** (Fix: M for bind-mount, L for MinIO)
- [ ] **#13 — LangGraph checkpointer migrations.** `director/src/main.py:150` relies on langgraph auto-creating `checkpoints` + `checkpoint_writes` tables at runtime. Move to Alembic migration so cold starts are deterministic. (Fix: S)
- [ ] **#14 — Provider service requirements.** Verify `nvidia-riva-client` is in `services/provider/pyproject.toml` and Dockerfile. Without it, the TTS path crashes on first call. (Fix: S, audit-only)
- [ ] **#15 — Health-check smoke test.** With #1–#11 landed: `make up`, verify all 8 services pass health checks, Scout produces a trend, full pipeline produces a video. (Fix: M, verification only)

---

### Acceptance Criteria (status reflects audit 2026-05-02)

#### Foundations (must be green before anything else)
- [x] Gateway auth (JWT + OAuth) working
- [x] Redis event bus wired across services
- [x] PostgreSQL with migrations
- [x] Notification system working
- [x] Identity → Provider key resolution verified end-to-end (`key_resolver.py` two-tier user→system; `IdentityClient` + `X-User-ID` contextvar; consuming services do not hardcode keys)
- [ ] **Provider swap test passes** — switching a service's provider requires only a dashboard settings change + new key in Identity. **Currently fails: route files hardcode adapter classes.** Unblocked by gap #3.
- [ ] All services start and pass health checks via Docker Compose (verification gate — gap #15)
- [ ] Cost tracking receives real data from events (works structurally; provider string wrong — gap #10)

#### Scout (Trend Detection)
- [x] Google Trends provider working
- [x] RSS provider working
- [ ] Twitter/X trend provider REMOVED (cleanup task — gap #11)
- [x] Trends flow into database with deduplication
- [x] Niche filter scopes trends to active niche
- [ ] TREND_DETECTED event fires and Director receives it (Scout side works; Director auto-trigger gated — gap #2)

#### Director (Content Creation)
- [ ] LangGraph pipeline runs end-to-end on a real trend (graph compiles; needs live NIM key smoke test — gap #15)
- [x] Analyst agent analyzes the trend
- [ ] ScriptGenerator produces narration text matching locked-format scene structure (no body-count validator — gap #7)
- [ ] VisualPrompter generates 1 hook + 4–5 body + 1 CTA image prompts (count unconstrained — gap #7)
- [ ] Output validates against locked-format JSON schema (rejects malformed before media spend) (cost gate missing — gap #7)
- [x] CritiqueAgent flags low-quality scripts before media generation
- [ ] CONTENT_CREATED event fires with **validated** script + visual prompts (event fires; validation missing — gap #7)
- [x] Content stored in database with full metadata

#### Media (Image Generation)
- [x] Free image provider adapter generates images from visual prompts (NVIDIA NIM Flux works)
- [x] Batch generation produces all 6–7 images per content piece
- [ ] Images stored in object storage, URLs accessible to Editor (local `/tmp/...` only — gap #12)
- [x] MEDIA_GENERATED event fires with image references
- [x] Per-scene retry on generation failure (max 2 retries)
- [ ] Adapter is hot-swappable (blocked by gap #3)
- [ ] Free image provider stack: NVIDIA NIM Flux primary + HuggingFace + Pollinations fallbacks (NIM Flux only — gaps #5, #6)

#### Editor (Video Assembly — single locked format)
- [x] TTS produces narration audio per scene (NIM Magpie via Provider service)
- [x] Whisper STT aligns captions to generated audio
- [x] Stitcher assembles hook + body + CTA into single MP4
- [x] Subtitle burner overlays Whisper-aligned captions
- [ ] Validator confirms output matches locked-format spec (resolution/codec/fps correct; **duration window wrong** — gap #1)
- [x] Final video stored, accessible via dashboard preview
- [ ] CONTENT_READY event fires (currently fires CONTENT_UPDATED — gap #9)

#### Dashboard (Visibility + Manual Approval Gate)
- [x] Trend feed page shows detected trends
- [ ] Pipeline page shows content moving through stages with current status (pages exist; end-to-end WS not verified — gap #15)
- [x] Content detail page: script, image grid, video preview, cost breakdown
- [x] Approve / Reject buttons on completed content
- [x] Cost tracking page shows per-content and per-service costs
- [ ] Settings page persists API keys via Identity service (server action wired; visible panel is demo UI — gap #8)
- [ ] Settings page persists provider preferences via Provider service (wired; not verified end-to-end)
- [ ] Real-time pipeline updates via WebSocket (hooks exist; gateway WS proxy unverified — gap #15)

---

### Tier 1.5 — Publishing (after MVP renders clean videos)

Split out because it's blocked on a new Twitter dev account, not on engineering.

- [ ] Gishant creates new X account dedicated to Orion-generated content
- [ ] Apply for X Developer access, obtain API keys (Basic tier sufficient for posting media)
- [ ] Publisher service uploads MP4 + posts via Twitter v2 API
- [ ] Publish triggered only after dashboard approval
- [ ] Post URL captured and stored
- [ ] Publish status updated in database

---

### What I Need From Gishant

- [x] Editor format → locked single-format vertical short (decided 2026-05-02)
- [x] TTS → NVIDIA NIM Magpie primary, FishSpeech fallback (resolved 2026-05-02 by audit — code already on NIM Magpie)
- [x] LLM provider → NVIDIA NIM (free Llama) for initial testing; quality upgrade via provider swap once pipeline is proven (decided 2026-05-02)
- [x] Image provider → free tier first (NVIDIA NIM Flux / Hugging Face / Pollinations); Fal.ai as quality upgrade later (decided 2026-05-02)
- [ ] NVIDIA NIM API key (free signup at `build.nvidia.com`)
- [ ] Hugging Face API token (free, fallback if NIM rate-limits)
- [ ] First niche (suggested: tech/AI news — Gishant's domain expertise)
- [ ] Twitter dev account (Tier 1.5 only)

---

### Provider Strategy: Free First, Quality Later

Tier 1 runs entirely on free providers. This serves two goals: zero-cost iteration during the build, and a forced stress-test of the Provider + Identity architecture (every provider swap is real-world validation).

**Locked initial stack (free):**
- LLM (Director): **NVIDIA NIM** — free hosted Llama 3.x at `build.nvidia.com`
- Images (Media): **NVIDIA NIM Flux** primary; Hugging Face Inference API + Pollinations.ai as fallback adapters (not yet built — gaps #5, #6)
- TTS (Editor): **NVIDIA NIM Magpie** via riva gRPC; FishSpeech as offline fallback adapter (not yet wired — gap #4)
- STT (captions): **Whisper** local

**Quality upgrade path (post-MVP, swap-only — no code changes outside adapters):**
- LLM → Anthropic Claude / OpenAI GPT-4-class for script quality
- Images → Fal.ai Flux Pro / Recraft for aesthetic consistency
- TTS → ElevenLabs if NIM Magpie voice blocks shipping
- TTS GPU path → NVIDIA Riva self-hosted if we go local-GPU

**Architecture rule:** every provider above lives as a swappable adapter under `services/provider/src/adapters/`. Adding a new one = one adapter class + one Identity key entry + one dashboard dropdown option. Zero changes elsewhere. The first paid-provider swap *is* the architecture validation gate — if it requires touching Director, Media, or Editor service code, the architecture has failed and needs rework before MVP ships.

---

## Tier 2 — Product (After MVP Renders + Publishes)

> Do NOT work on these until Tier 1 + 1.5 are complete.

- [ ] Multi-platform publishing (YouTube Shorts, TikTok, Instagram Reels)
- [ ] Content scheduling (publish at optimal times)
- [ ] Multi-niche support (switch between niches)
- [ ] Style library (multiple locked formats — news short, explainer, listicle)
- [ ] Multi-user with proper data isolation
- [ ] Engagement analytics from published platforms
- [ ] Automated approval (skip manual gate once quality is proven)
- [ ] ComfyUI local image generation as Fal.ai alternative
- [ ] MinIO/S3 object storage replaces bind-mount volume
- [ ] Anthropic / OpenAI as primary LLM provider option

---

## Tier 3 — Scale (After Product)

> Long-term vision. Not actionable yet.

- [ ] Local LLM support (Ollama) alongside cloud
- [ ] White-label for agencies (Path B SaaS launch readiness)
- [ ] A/B testing content styles
- [ ] Engagement-driven optimization (learn what performs)
- [ ] Team roles and permissions
- [ ] Billing and subscription management
- [ ] Public API for third-party integrations

---

## Agent Instructions

### For the Analyst
1. Read this file FIRST before scanning the codebase
2. Only report findings that block unchecked **Tier 1** items as critical/high
3. The "Audit-Identified Gaps" section is the literal worklist — items there are higher priority than generic acceptance-criteria checkboxes
4. Tier 1.5 findings become critical only after all Tier 1 boxes are `[x]`
5. Tag all Tier 2/3 findings as `deferred:tier2` or `deferred:tier3`
6. When all Tier 1 criteria + all gap items are `[x]`, report: "MVP READY — all acceptance criteria + audit gaps closed"

### For the Judge
1. Prioritize decisions that move Tier 1 checkboxes (and gap items) from `[ ]` to `[x]`
2. Reject any proposal that scope-creeps into Tier 2 features
3. Reject any proposal to deviate from the Locked Output Format spec
4. When evaluating tradeoffs, always ask: "Does this help ship a renderable video?"

### For the Sprint Planner
1. Order tasks by which Tier 1 checkbox or audit gap they unblock
2. The Audit-Identified Gaps are sequenced — work them in numbered order
3. Gap #3 (provider route adapter factory) is the highest-leverage architectural fix; without it the swap test cannot pass
4. Gap #1 + #2 (validator duration + director auto-trigger) are zero-effort wins — schedule first
5. Highlight what Gishant needs to provide (NIM key, HF token, niche, Twitter dev account)

---

_Last updated: 2026-05-02 by Nova (post-audit)_
_Helix project removed from scope — separate project, not before Q3/Q4._
_TTS resolved to NVIDIA NIM Magpie primary (matches existing code + free-NVIDIA strategy); FishSpeech becomes fallback adapter. See `docs/TIER1_AUDIT_2026-05-02.md` for full evidence._
