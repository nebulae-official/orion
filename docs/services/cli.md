# CLI

The Orion CLI is a Go command-line tool that provides full control over the Orion platform through the gateway API. It handles authentication, trend management, content workflows, provider switching, and system administration — all from your terminal.

| Property      | Value                          |
| ------------- | ------------------------------ |
| **Binary**    | `bin/orion`                    |
| **Language**  | Go 1.24                        |
| **Framework** | Cobra 1.9.x                    |
| **Source**    | `cmd/cli/` and `internal/cli/` |
| **Config**    | `~/.orion/config.yaml`         |

## :material-download: Build the CLI

```bash
# Build both gateway and CLI
make build

# Or build the CLI alone
go build -o bin/orion ./cmd/cli

# Verify the build
./bin/orion version
```

---

## :material-console: Global Flags

These flags are available on every command:

| Flag            | Short | Default                 | Description                            |
| --------------- | ----- | ----------------------- | -------------------------------------- |
| `--gateway-url` |       | `http://localhost:8000` | Gateway base URL to connect to         |
| `--output`      | `-o`  | `text`                  | Output format: `json`, `table`, `text` |
| `--verbose`     | `-v`  | `false`                 | Enable verbose debug logging           |
| `--config`      |       | `~/.orion/config.yaml`  | Path to config file                    |

### Output formats

```bash
# Default text output (human readable)
./bin/orion scout trends

# JSON output (for scripting and piping to jq)
./bin/orion scout trends --output json

# Table output (structured columns)
./bin/orion scout trends --output table

# Pipe JSON output to jq for filtering
./bin/orion scout trends --output json | jq '.[] | select(.score > 0.8)'
```

---

## :material-key: `auth` — Authentication

Manage your session with the Orion gateway. The CLI stores JWT tokens locally in `~/.orion/config.yaml` so you only need to authenticate once per session.

### `orion auth login`

Interactive login. Prompts for username and password, obtains a JWT token from the gateway, and stores it locally.

```bash
./bin/orion auth login
# Username: admin
# Password: ****
# Logged in as admin (expires: 2026-03-14T10:00:00Z)
```

| Flag        | Default                | Description                         |
| ----------- | ---------------------- | ----------------------------------- |
| `--api-url` | (from `--gateway-url`) | Override gateway URL for this login |

### `orion auth logout`

Clear stored credentials. Removes the JWT token and user information from the local config file.

```bash
./bin/orion auth logout
# Credentials cleared.
```

### `orion auth status`

Display current authentication state — connected user, server URL, and when the token expires.

```bash
./bin/orion auth status
# User:    admin
# Server:  http://localhost:8000
# Expires: 2026-03-14T10:00:00Z
# Status:  authenticated
```

---

## :material-radar: `scout` — Trend Detection

Trigger scans, query detected trends, and manage Scout service configuration. Scout polls external sources (Google Trends, RSS feeds, Twitter/X) for emerging topics and scores them by velocity and relevance.

### `orion scout trigger`

Initiate a new trend scan. The scan runs asynchronously — results appear via `scout trends` once processing completes.

| Flag        | Default | Description                                             |
| ----------- | ------- | ------------------------------------------------------- |
| `--sources` | all     | Comma-separated source list: `google`, `rss`, `twitter` |
| `--regions` | `US`    | Comma-separated region codes: `US`, `GB`, `IN`, etc.    |

```bash
# Scan all sources in the US
./bin/orion scout trigger

# Scan only Google Trends and RSS in the US and UK
./bin/orion scout trigger --sources google,rss --regions US,GB

# Scan Twitter only
./bin/orion scout trigger --sources twitter --regions US
```

### `orion scout trends`

List trends detected by previous scans, ordered by score.

| Flag          | Default | Description                                            |
| ------------- | ------- | ------------------------------------------------------ |
| `--limit`     | 20      | Maximum number of trends to return                     |
| `--min-score` | 0.0     | Filter out trends below this score threshold (0.0–1.0) |

```bash
# List the top 5 trends
./bin/orion scout trends --limit 5

# List high-confidence trends only
./bin/orion scout trends --min-score 0.7

# Get trends as JSON for scripting
./bin/orion scout trends --limit 10 --output json

# Combine filters
./bin/orion scout trends --limit 20 --min-score 0.5 --output table
```

### `orion scout config`

View or update the Scout service configuration (niche settings, score thresholds, source weights).

| Flag     | Default | Description                       |
| -------- | ------- | --------------------------------- |
| `--show` |         | Display the current configuration |
| `--set`  |         | Set a value in `KEY=VALUE` format |

```bash
# View current configuration
./bin/orion scout config --show

# Update the minimum score threshold
./bin/orion scout config --set min_score=0.8

# Update the target niche
./bin/orion scout config --set niche=technology
```

---

## :material-file-document: `content` — Content Management

Manage the full content lifecycle — list items, inspect details, approve for publishing, reject with feedback, or request regeneration. Content flows through statuses: `draft` → `generating` → `review` → `approved` → `published` (or `rejected`).

### `orion content list`

List content items, optionally filtered by pipeline status.

| Flag       | Default | Description                                                                            |
| ---------- | ------- | -------------------------------------------------------------------------------------- |
| `--status` | (all)   | Filter by status: `draft`, `generating`, `review`, `approved`, `published`, `rejected` |
| `--limit`  | 20      | Maximum items to return                                                                |

```bash
# List all content
./bin/orion content list

# List content awaiting human review
./bin/orion content list --status review

# List recently published content
./bin/orion content list --status published --limit 10

# List content currently being generated
./bin/orion content list --status generating

# JSON output for scripting
./bin/orion content list --status review --output json
```

### `orion content view <id>`

Display full details for a content item — including the generated script body, visual prompts, asset URLs, pipeline metadata, and current status.

```bash
./bin/orion content view abc-123

# JSON output with all fields
./bin/orion content view abc-123 --output json
```

### `orion content approve <id>`

Approve a content item for publishing. Once approved, the Publisher service picks it up and distributes it to configured social platforms.

| Flag            | Default     | Description                               |
| --------------- | ----------- | ----------------------------------------- |
| `--schedule-at` | (immediate) | RFC3339 datetime for scheduled publishing |

```bash
# Approve for immediate publishing
./bin/orion content approve abc-123

# Schedule publishing for a specific time
./bin/orion content approve abc-123 --schedule-at 2026-03-15T10:00:00Z
```

### `orion content reject <id>`

Reject a content item with feedback. Optionally specify a follow-up action.

| Flag         | Required | Description                                           |
| ------------ | -------- | ----------------------------------------------------- |
| `--feedback` | Yes      | Reason for rejection (sent back to Director)          |
| `--action`   | No       | Follow-up: `REGENERATE` (retry) or `DISCARD` (delete) |

```bash
# Reject and request regeneration
./bin/orion content reject abc-123 \
  --feedback "Hook is too generic, needs a stronger opening" \
  --action REGENERATE

# Reject and discard entirely
./bin/orion content reject abc-123 \
  --feedback "Topic is no longer trending" \
  --action DISCARD
```

### `orion content regenerate <id>`

Queue a content item for regeneration through the LangGraph pipeline. Optionally provide feedback to guide the next generation.

| Flag         | Default | Description                           |
| ------------ | ------- | ------------------------------------- |
| `--feedback` | (none)  | Guidance for the regeneration attempt |

```bash
# Simple regeneration
./bin/orion content regenerate abc-123

# Regeneration with guidance
./bin/orion content regenerate abc-123 --feedback "Make the tone more technical and authoritative"
```

---

## :material-swap-horizontal: `provider` — AI Provider Management

Manage AI providers across services. Orion uses the Strategy pattern — each service can switch between LOCAL (self-hosted) and CLOUD providers at runtime without restarts.

### `orion provider list`

List all configured providers for every service, showing which is currently active.

```bash
./bin/orion provider list

# JSON output
./bin/orion provider list --output json
```

### `orion provider switch <service>`

Switch a service's active AI provider between LOCAL and CLOUD modes.

| Flag         | Required | Description                                                   |
| ------------ | -------- | ------------------------------------------------------------- |
| `--mode`     | Yes      | Provider mode: `LOCAL` or `CLOUD`                             |
| `--provider` | Yes      | Provider name (e.g., `comfyui`, `fal_ai`, `ollama`, `openai`) |

```bash
# Switch Media service to cloud provider
./bin/orion provider switch media --mode CLOUD --provider fal_ai

# Switch Media back to local ComfyUI
./bin/orion provider switch media --mode LOCAL --provider comfyui

# Switch Editor to cloud TTS
./bin/orion provider switch editor --mode CLOUD --provider openai

# Switch Director to local Ollama
./bin/orion provider switch director --mode LOCAL --provider ollama
```

### `orion provider status`

Display health and cost details for all active providers across services. Shows latency, request counts, error rates, and accumulated costs.

```bash
./bin/orion provider status

# JSON output for monitoring scripts
./bin/orion provider status --output json
```

---

## :material-heart-pulse: `system` — System Administration

Monitor and administer the Orion platform.

### `orion health`

Quick health check on the gateway. Use `--all` to check every service.

| Flag    | Description                                     |
| ------- | ----------------------------------------------- |
| `--all` | Check health of all services (not just gateway) |

```bash
# Gateway only
./bin/orion health

# All services
./bin/orion health --all
```

### `orion status`

Show a high-level system overview — system mode, GPU availability, queue depth, and active content count.

```bash
./bin/orion status
```

### `orion system health`

Detailed health check that hits `/health` on all services concurrently and displays a status table.

```bash
./bin/orion system health
```

### `orion system status`

Extended system status with mode, GPU availability, queue depth, and active content metrics.

```bash
./bin/orion system status
```

### `orion system logs <service>`

Retrieve logs from a specific service through the gateway.

| Flag       | Short | Default | Description                     |
| ---------- | ----- | ------- | ------------------------------- |
| `--tail`   | `-n`  | 50      | Number of log lines to retrieve |
| `--follow` | `-f`  | `false` | Stream logs in real time        |

```bash
# View last 50 lines from Scout
./bin/orion system logs scout

# View last 200 lines
./bin/orion system logs scout --tail 200

# Stream logs in real time
./bin/orion system logs director --follow

# View gateway logs
./bin/orion system logs gateway -n 100
```

### `orion version`

Print the CLI version, git commit hash, and build date.

```bash
./bin/orion version
# orion version 0.1.0 (commit: abc1234, built: 2026-03-13T00:00:00Z)
```
