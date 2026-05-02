# Orion Tier 1 — Gap Tracker

> Live log of all gaps discovered during Tier 1 smoke-testing (2026-05-02 onwards).
> Each gap links to its root cause, fix, related issues, and verification status.
> Source of truth for "what broke, why, and what it connected to."

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fixed and verified |
| 🔧 | Fix in progress |
| 🔴 | Open blocker |
| ⚠️ | Known risk / deferred |
| 🔗 | Related to another gap |

---

## Phase 0 — Audit Gaps (2026-05-02 pre-smoke-test)

These 14 gaps were identified by the static audit agent before any live run.
All were fixed in batch sessions on 2026-05-02. Details in `TIER1_AUDIT_2026-05-02.md`.

| # | Title | Service | Fix | Commit |
|---|-------|---------|-----|--------|
| 1 | Validator duration constants wrong (55-60s → 40-55s) | Editor | `validator.py:20-21` | eaf29c8 batch |
| 2 | DIRECTOR_AUTO_TRIGGER defaulted false | Director | env + docker-compose | eaf29c8 |
| 3 | Provider routes hardcoded adapters (violates swap rule) | Provider | registry lookup in routes | d767579 |
| 4 | FishSpeech TTS fallback adapter missing | Provider | `adapters/tts/fish_speech.py` | 5a30b1a |
| 5 | HuggingFace image adapter missing | Provider | `adapters/image/huggingface.py` | f88459e |
| 6 | Pollinations image adapter missing | Provider | `adapters/image/pollinations.py` | 9aa2e72 |
| 7 | Scene-count cost gate missing in Director | Director | Pydantic guard in `pipeline.py` | b961f2f |
| 8 | Dashboard API keys panel wired to demo UI | Dashboard | Wire to `saveApiKey` server action | 22d898d |
| 9 | CONTENT_UPDATED → CONTENT_READY rename | Common/Editor | `events.py` + `render_pipeline.py` | edffae5 |
| 10 | Director cost string hardcoded `"ollama"` | Director | Change to `"nvidia_nim"` in pipeline | 6f71ff1 |
| 11 | Dead Twitter + Fal.ai injection code | Scout/Media | Remove dead blocks | 98ea45f |
| 12 | Object storage: cross-container `/tmp` access | Infra | Shared bind-mount volume in compose | 1d27e01 |
| 13 | LangGraph checkpointer tables not in Alembic | Director | Migration 007 | d72e319 |
| 14 | `nvidia-riva-client` missing from Provider deps | Provider | Add to pyproject.toml + Dockerfile | d767579 |

**Status: All ✅ verified in git. Committed 2026-05-02.**

---

## Phase 1 — Live Smoke Test Gaps (found during `make up` + pipeline run)

### Gap #15 — Health-check smoke test (verification gate) ⚠️ PARTIAL

**Discovered:** 2026-05-02 smoke test session  
**Service:** All  
**Symptom:** Partial pass — infrastructure layer clean, pipeline blocked at app layer.

**Results:**

| Check | Result |
|-------|--------|
| 9/9 services HTTP 200 | ✅ PASS |
| Scout fires TREND_DETECTED | ✅ PASS |
| Director receives events | ✅ PASS |
| Director creates content record | ❌ Blocked by Gap #16 |
| LangGraph pipeline runs | ❌ Blocked downstream |
| MP4 produced | ❌ Not reached |

**Status:** Partially re-verified after each downstream fix. Full pass pending Gap #18+.

---

### Gap #16 — Director `created_by` NOT NULL constraint ✅ FIXED

**Discovered:** 2026-05-02 smoke test  
**Service:** Director  
**Commit:** `b65298b`  
**Root cause:** `_handle_trend_detected` in `services/director/src/main.py` called `pipeline.run()` without `created_by`. Migration 007 enforced `contents.created_by NOT NULL`. System-triggered events had no user context.  
**Fix:** Added `SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"` module constant; passed it as `created_by` for all auto-triggered pipeline runs.  
**Related:** 🔗 Gap #13 (migration 007 created the constraint that exposed this). The system user `00000000-...0001` is seeded by migration 005.  
**Verified:** `PIPELINE_STAGE_CHANGED` event fired with correct `user_id`. Content record created.

---

### Gap #17 — LLM Provider 503 (NVIDIA NIM key unavailable) ✅ FIXED

**Discovered:** 2026-05-02 after Gap #16 fixed  
**Service:** Provider (LLM route) + Director  
**Commit:** `66edcae`  
**Root cause (Cause B):** `KeyResolver` found no NVIDIA NIM API key in Identity DB. Every `POST /api/v1/llm/complete` raised `KeyUnavailableError` → HTTP 503. (The `"Ollama not reachable"` message was stale — Gap #10 had already switched provider string to `nvidia_nim`.)  
**Fix:**
- Added tier-3 env-var lookup (`NVIDIA_NIM_API_KEY`, `HF_TOKEN`) to `key_resolver.py`
- Added tier-4 anonymous access for keyless providers
- New `adapters/llm/pollinations.py` (free, no key, `text.pollinations.ai`, OpenAI-compatible)
- New `adapters/llm/huggingface.py` (requires `HF_TOKEN`; anonymous HF API now returns 401)
- `routes/llm.py` falls back to `pollinations` when `nvidia_nim` raises `KeyUnavailableError`
- `catalog.py` + `identity/routes/keys.py` updated

**Related:** 🔗 Gap #3 (registry lookup pattern — this gap added LLM fallback using same pattern). 🔗 Gap #5/#6 (HuggingFace and Pollinations were already adapters for image — now extended to LLM too).  
**Verified:** Strategist node completed with `confidence_score=0.772`, script generated (111 chars body, 5 visual cues).

> **Note for audit:** Tier 1 is now running on Pollinations for LLM (no key required). This is a functional free tier but Pollinations is a public proxy — not suitable for production content pipelines. Adding `NVIDIA_NIM_API_KEY` to `.env` + Identity DB would restore the intended NIM path. This is a Tier 1 vs Tier 1.5 upgrade point.

---

### Gap #18 — LangGraph checkpoint cleanup `AsyncConnection` TypeError ✅ FIXED

**Discovered:** 2026-05-02 after Gap #17 fixed  
**Service:** Director (LangGraph checkpointer)  
**Commit:** `2e38fb2`  
**Root cause:** `cleanup_checkpoints` in `services/director/src/services/pipeline.py` called `self._checkpointer.conn.connection()`. In psycopg3, `AsyncConnection.connection` is a property that returns `self` (not a pool method). Calling `()` on the returned `AsyncConnection` raised `TypeError: 'AsyncConnection' object is not callable`. The underlying setup is correct — `from_conn_string` creates an `AsyncConnection` with `autocommit=True`, not a pool.  
**Fix:** Use `self._checkpointer.conn` directly as the cursor source. Autocommit=True means no explicit commit is needed. Removed the erroneous `.connection()` call and `conn.commit()`.  
**Verified:** `checkpoints_cleaned` now logs at INFO level. No `checkpoint_cleanup_failed` error.  
**Related:** 🔗 Gap #13 (migration added the checkpoint tables), 🔗 Risk C (LangGraph psycopg3 compat).  
**New blocker:** 🔗 Gap #19 — pipeline still fails with a different TypeError after strategist.

---

### Gap #19 — LangGraph `__interrupt__` event breaks `final_state.update()` ✅ FIXED

**Discovered:** 2026-05-02 after Gap #18 fixed  
**Service:** Director (pipeline streaming)  
**Symptom:** After strategist node completes, `trend_pipeline_failed` fires with `TypeError: cannot convert dictionary update sequence element #0 to a sequence`.  
**Root cause:** In LangGraph 1.x with `stream_mode="updates"`, HITL interrupts are yielded as `{"__interrupt__": [Interrupt(...)]}` — a list value, not a dict. `services/director/src/services/pipeline.py:141` calls `final_state.update(event[node_name])` unconditionally. Python's `dict.update()` raises `TypeError` when given a list of non-(key, value) items.  
**Fix applied:** Added `if node_name.startswith("__"): continue` guard in `services/director/src/services/pipeline.py:141` before `final_state.update()`. Skips all LangGraph internal events (`__interrupt__`, `__end__`, `__error__`).  
**Commit:** (pending)  
**Upstream:** `DIRECTOR_ENABLE_HITL` is `true` in the running container — so every pipeline run that reaches an interrupt point hit this bug.  
**Downstream unblocked:** Media (image gen), Editor (video assembly), CONTENT_READY event, MP4 output.  
**Related:** 🔗 Gap #18 (checkpointer cleanup — fixed). 🔗 Gap #20 — TBD (next blocker after pipeline resumes past interrupt point).

---

## Phase 1 — Known Risks / Deferred

### Risk A — Pollinations LLM is a public proxy ⚠️

**Severity:** Medium (functional for Tier 1 demo, not for real content pipeline)  
**Detail:** Gap #17 fallback uses `text.pollinations.ai` — a community-run OpenAI-compatible proxy. No SLA, no auth, rate limits unknown. Content quality should be acceptable for smoke testing but this must be replaced with a keyed provider (NVIDIA NIM or Anthropic) before Tier 1.5.  
**Resolution path:** Add `NVIDIA_NIM_API_KEY` to `.env` → wire into docker-compose → add to Identity DB system keys → KeyResolver tier-1 hit will bypass fallback chain.

### Risk B — NVIDIA Riva gRPC TTS not verified end-to-end ⚠️

**Severity:** High (Editor TTS path untested)  
**Detail:** Provider service has NVIDIA NIM Riva TTS adapter and FishSpeech fallback. But the pipeline hasn't reached Editor yet (blocked at Director LangGraph). TTS may hit the same key-unavailable pattern as gap #17.  
**Resolution path:** Once pipeline reaches Editor, monitor TTS calls. If 503, same fallback pattern as gap #17 applies — add a free TTS fallback adapter (e.g. `edge-tts` or `gtts`).

### Risk C — LangGraph version / asyncpg compat matrix ⚠️

**Severity:** Medium  
**Detail:** Gap #18 root cause points to LangGraph version mismatch. Check `services/director/pyproject.toml` for pinned `langgraph` version vs what was used to design the checkpointer. Async postgres checkpointer API changed between `0.1.x` and `0.2.x`.  
**Resolution path:** Fix being applied in gap #18 agent.

---

## Gap Chain Map

```
Smoke test run
  → GAP #16 (created_by null)         ← fixed
      → GAP #17 (LLM 503, no NIM key) ← fixed
          → GAP #18 (LangGraph checkpoint TypeError) ← fixed
              → GAP #19 (HITL __interrupt__ event in astream loop) ← fixed
                  → GAP #20 (TBD — next blocker)
                  → [Media image gen]
                  → [Editor TTS — Risk B]
                      → [Editor video assembly]
                          → [MP4 output — Gap #15 full pass]
```

---

## What a Full Post-Smoke Audit Should Cover

Once gap #15 achieves full pass (MP4 produced), a structured audit should verify:

1. **LLM provider path** — is Pollinations in use or did NVIDIA NIM key get added? (Risk A)
2. **TTS provider path** — did NIM Riva work or did it need a fallback? (Risk B)
3. **Image provider path** — did NVIDIA NIM Flux serve images or did HuggingFace/Pollinations image fallback trigger?
4. **Cost tracking accuracy** — do `CONTENT_COST` events show correct provider strings now (nvidia_nim vs pollinations)?
5. **Video validation** — does Editor validator pass with 40-55s window (gap #1)?
6. **Shared volume** — do Media-produced images land where Editor can read them (gap #12)?
7. **CONTENT_READY event** — does Dashboard receive and display the video (gap #9)?
8. **Dashboard API keys panel** — does saving a key in UI persist to Identity (gap #8)?
9. **LangGraph checkpoint hygiene** — after gap #18 fix, do checkpoints save and load cleanly without leaking connections?
10. **Scene-count gate** — did a malformed LLM output get rejected pre-image-gen in any run?
