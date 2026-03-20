# :lucide-terminal: CLI Workflow Demo

Complete CLI-only walkthrough of the Orion platform. Every step uses the `orion` CLI tool with realistic example outputs.

## :lucide-check-square: Prerequisites

Install and verify the CLI:

```bash
cd cli
uv sync
uv run orion --help
```

Ensure the Orion stack is running:

```bash
docker compose -f deploy/docker-compose.yml up -d
```

---

## :lucide-log-in: 1. Authenticate

```bash
orion auth login
```

```
Email: admin@orion.local
Password: ****
Logged in successfully. Token: eyJhbGciOi...
```

Verify your session:

```bash
orion auth whoami
```

```
Authenticated. Token: eyJhbGciOi...
```

!!! tip "Quick Re-Authentication"
    If your token expires mid-session, run `orion auth login` again. The CLI will overwrite the stored token automatically. You can also set `ORION_AUTH_TOKEN` as an environment variable for CI/CD pipelines.

---

## :lucide-search: 2. Trigger a Trend Scan

```bash
orion scout trigger
```

```
Scan triggered successfully.
```

Wait a few seconds for the scan to complete, then list results:

```bash
orion scout list-trends --format table
```

```
┌────────┬──────────────────────────────────────────────┬───────┬────────────────┬────────┐
│ ID     │ Topic                                        │ Score │ Source         │ Status │
├────────┼──────────────────────────────────────────────┼───────┼────────────────┼────────┤
│ t-001  │ AI Agents Replace Junior Devs — Hype or ...  │  0.94 │ google_trends  │ NEW    │
│ t-003  │ Apple Vision Pro 2 Leak Sparks AR/VR Debate  │  0.91 │ twitter        │ NEW    │
│ t-002  │ Rust Adoption Surges in Enterprise Backend   │  0.87 │ rss            │ NEW    │
│ t-004  │ Open-Source LLMs Close the Gap on GPT-5      │  0.82 │ google_trends  │ NEW    │
│ t-006  │ WebAssembly Enters Server-Side Mainstream     │  0.73 │ twitter        │ NEW    │
└────────┴──────────────────────────────────────────────┴───────┴────────────────┴────────┘
```

View trends in JSON format:

```bash
orion scout list-trends --format json
```

```
┌────────┬──────────────────────────────────────────────┬───────┬────────────────┬────────┐
│ ID     │ Topic                                        │ Score │ Source         │ Status │
├────────┼──────────────────────────────────────────────┼───────┼────────────────┼────────┤
│ t-001  │ AI Agents Replace Junior Devs — Hype or ...  │  0.94 │ google_trends  │ NEW    │
│ t-003  │ Apple Vision Pro 2 Leak Sparks AR/VR Debate  │  0.91 │ twitter        │ NEW    │
└────────┴──────────────────────────────────────────────┴───────┴────────────────┴────────┘
```

!!! tip "Power User: JSON for Scripting"
    Use `orion scout list-trends --format json` combined with `jq` for scripting automated content pipelines.

---

## :lucide-file-text: 3. View Generated Content

The Director service automatically picks up new trends and generates content via the LangGraph pipeline. Check on content status:

```bash
orion content list
```

```
┌────────────┬────────────────────────────────────────────┬────────────┬──────────────────┬──────────┐
│ ID         │ Title                                      │ Status     │ Platform         │ Created  │
├────────────┼────────────────────────────────────────────┼────────────┼──────────────────┼──────────┤
│ c-a1b2c3d4 │ AI Agents: Hype vs Reality in 2026        │ review     │ youtube_shorts   │ 2h ago   │
│ c-e5f6a7b8 │ Why Rust Is Taking Over Enterprise        │ generating │ youtube_shorts   │ 1h ago   │
│ c-c9d0e1f2 │ Vision Pro 2: What We Know So Far         │ generating │ tiktok           │ 45m ago  │
└────────────┴────────────────────────────────────────────┴────────────┴──────────────────┴──────────┘
```

View content in JSON format:

```bash
orion content list --format json
```

```
┌────────────┬────────────────────────────────────────────┬────────┬──────────────────┬──────────┐
│ ID         │ Title                                      │ Status │ Platform         │ Created  │
├────────────┼────────────────────────────────────────────┼────────┼──────────────────┼──────────┤
│ c-a1b2c3d4 │ AI Agents: Hype vs Reality in 2026        │ review │ youtube_shorts   │ 2h ago   │
└────────────┴────────────────────────────────────────────┴────────┴──────────────────┴──────────┘
```

View full details of a content item:

```bash
orion content view c-a1b2c3d4
```

```
Content: c-a1b2c3d4
──────────────────────
Title:    AI Agents: Hype vs Reality in 2026
Status:   review
Platform: youtube_shorts
Trend:    t-001 (AI Agents Replace Junior Devs — Hype or Reality?)

Script:
  "AI agents are everywhere — but are they actually replacing developers?
   Let's break down what's real and what's hype..."

Assets:
  - image: assets/c-a1b2c3d4/thumbnail.png (1280x720)
  - audio: assets/c-a1b2c3d4/voiceover.mp3 (45s)
  - video: assets/c-a1b2c3d4/final.mp4 (1080x1920, 58s)

Created:  2026-03-18T09:15:00Z
Updated:  2026-03-18T09:42:00Z
```

---

## :lucide-check-circle: 4. Approve or Reject Content

Approve content for publishing:

```bash
orion content approve c-a1b2c3d4
```

```
Content c-a1b2c3d4 approved.
Status: review -> approved
```

Reject content:

```bash
orion content reject c-a1b2c3d4
```

Request regeneration:

```bash
orion content regenerate c-a1b2c3d4
```

!!! tip "Batch Operations"
    Approve multiple items at once by piping IDs: `orion content list --format json | jq -r '.[].id' | xargs -I{} orion content approve {}`.

---

## :lucide-send: 5. Publish Content

List connected social accounts:

```bash
orion publish accounts
```

```
┌──────────┬────────────────┬───────────┐
│ Platform │ Account        │ Status    │
├──────────┼────────────────┼───────────┤
│ twitter  │ @orion_demo    │ connected │
│ youtube  │ Orion Channel  │ connected │
│ tiktok   │ @orion.ai      │ connected │
└──────────┴────────────────┴───────────┘
```

Publish to a platform:

```bash
orion publish send c-a1b2c3d4 --platform twitter
```

```
Publishing c-a1b2c3d4 to twitter...
Published successfully.
Post URL: https://twitter.com/orion_demo/status/1234567890
```

View publishing history:

```bash
orion publish history
```

```
┌────────────┬──────────────────────────────────┬──────────┬───────────┬──────────────────┐
│ Content    │ Title                            │ Platform │ Status    │ Published        │
├────────────┼──────────────────────────────────┼──────────┼───────────┼──────────────────┤
│ c-a1b2c3d4 │ AI Agents: Hype vs Reality      │ twitter  │ published │ 2026-03-18 11:30 │
└────────────┴──────────────────────────────────┴──────────┴───────────┴──────────────────┘
```

---

## :lucide-heart-pulse: 6. Check System Health

Overall status:

```bash
orion system status
```

```
Orion System Status
───────────────────
Mode:       LOCAL
GPU:        Available (NVIDIA RTX 4090, 24GB)
Services:   6/6 healthy
Queue:      3 items pending
Uptime:     2h 15m
```

Detailed health check:

```bash
orion system health
```

```
┌───────────┬─────────┬──────────────┬──────────┐
│ Service   │ Status  │ Latency      │ Version  │
├───────────┼─────────┼──────────────┼──────────┤
│ gateway   │ healthy │ 2ms          │ 0.1.0    │
│ scout     │ healthy │ 15ms         │ 0.1.0    │
│ director  │ healthy │ 12ms         │ 0.1.0    │
│ media     │ healthy │ 18ms         │ 0.1.0    │
│ editor    │ healthy │ 14ms         │ 0.1.0    │
│ pulse     │ healthy │ 11ms         │ 0.1.0    │
└───────────┴─────────┴──────────────┴──────────┘
```

JSON output for scripting:

```bash
orion system health --format json
```

```json
{
  "status": "healthy",
  "services": {
    "gateway":  { "status": "healthy", "latency_ms": 2 },
    "scout":    { "status": "healthy", "latency_ms": 15 },
    "director": { "status": "healthy", "latency_ms": 12 },
    "media":    { "status": "healthy", "latency_ms": 18 },
    "editor":   { "status": "healthy", "latency_ms": 14 },
    "pulse":    { "status": "healthy", "latency_ms": 11 }
  },
  "mode": "LOCAL",
  "gpu_available": true
}
```

---

## :lucide-bookmark: Quick Reference

| Action              | Command                                                  |
| ------------------- | -------------------------------------------------------- |
| Login               | `orion auth login`                                       |
| Trigger scan        | `orion scout trigger`                                    |
| List trends         | `orion scout list-trends`                                |
| List content        | `orion content list`                                     |
| View content        | `orion content view <id>`                                |
| Approve             | `orion content approve <id>`                             |
| Reject              | `orion content reject <id>`                              |
| Publish             | `orion publish send <id> --platform twitter`             |
| System status       | `orion system status`                                    |
| Health check        | `orion system health`                                    |

---

## :lucide-arrow-right: Next Steps

- **[Full Pipeline Demo](demo-full-pipeline.md)** -- Walkthrough with both CLI and Dashboard
- **[Provider Setup](demo-provider-setup.md)** -- Switch between local and cloud AI providers
- **[CLI Reference](../services/cli.md)** -- Complete CLI command documentation
- **[CLI Quickstart](cli-quickstart.md)** -- Quick reference for common commands
