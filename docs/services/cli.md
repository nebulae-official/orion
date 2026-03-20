# CLI

The Orion CLI is a Python command-line tool built with [Typer](https://typer.tiangolo.com/) that provides full control over the Orion platform through the gateway API. It handles authentication, trend management, content workflows, provider switching, and system administration — all from your terminal.

| Property      | Value                       |
| ------------- | --------------------------- |
| **Language**  | Python 3.13                 |
| **Framework** | Typer 0.15.x                |
| **Source**    | `cli/src/orion_cli/`        |
| **Config**    | `~/.orion/config.toml`      |
| **Install**   | uv workspace member         |

## :material-download: Installation

The CLI is a uv workspace member. Install and run from the `cli/` directory:

```bash
cd cli
uv sync
uv run orion --help
```

Or use the Makefile:

```bash
make cli-dev ARGS="--help"
```

---

## :material-console: Global Options

These options are available on every command:

| Option     | Default                 | Description                       |
| ---------- | ----------------------- | --------------------------------- |
| `--format` | `table`                 | Output format: `table`, `json`, `plain` |
| `--help`   |                         | Show help for any command         |

Configuration is stored in `~/.orion/config.toml`:

```toml
gateway_url = "http://localhost:8000"
```

### Output formats

```bash
# Default table output (human readable, uses Rich)
orion scout list-trends

# JSON output (for scripting and piping to jq)
orion scout list-trends --format json

# Plain output (tab-separated values)
orion scout list-trends --format plain
```

**Table output example:**

![Table output](../assets/cli/scout-list-trends.svg)

---

## :material-key: `auth` — Authentication

Manage your session with the Orion gateway. The CLI stores JWT tokens in `~/.orion/token`.

### `orion auth login`

Interactive login. Prompts for email and password, obtains a JWT token from the gateway, and stores it locally.

```bash
orion auth login
# Email: admin@orion.local
# Password: ****
# Logged in successfully
```

### `orion auth logout`

Clear stored credentials.

```bash
orion auth logout
# Credentials cleared.
```

### `orion auth whoami`

Display current authentication state.

```bash
orion auth whoami
```

---

## :material-heart-pulse: `system` — System Health & Status

Monitor the Orion platform.

### `orion system health`

Check health of all services.

```bash
orion system health
```

### `orion system status`

Show system overview — mode, GPU availability, queue depth.

```bash
orion system status
```

---

## :material-radar: `scout` — Trend Detection

Trigger scans, query detected trends, and manage Scout service configuration.

### `orion scout list-trends`

List trends detected by previous scans.

```bash
orion scout list-trends
orion scout list-trends --format json
```

![orion scout list-trends](../assets/cli/scout-list-trends.svg)

JSON output:

![orion scout list-trends --format json](../assets/cli/scout-list-trends-json.svg)

### `orion scout trigger`

Trigger an immediate trend scan.

```bash
orion scout trigger
orion scout trigger --format json
```

![orion scout trigger](../assets/cli/scout-trigger.svg)

### `orion scout configure`

Configure the active niche for trend scanning.

```bash
orion scout configure tech
orion scout configure gaming --format json
```

![orion scout configure](../assets/cli/scout-configure.svg)

---

## :material-file-document: `content` — Content Management

Manage the full content lifecycle — list, inspect, approve, reject, regenerate.

### `orion content list`

```bash
orion content list
orion content list --format json
```

### `orion content view <id>`

```bash
orion content view abc-123
orion content view abc-123 --format json
```

### `orion content approve <id>`

```bash
orion content approve abc-123
```

### `orion content reject <id>`

```bash
orion content reject abc-123
```

---

## :material-pipe: `pipeline` — Pipeline Runs

View and manage content pipeline executions.

```bash
orion pipeline status
orion pipeline run <trend-id>
orion pipeline logs
```

---

## :material-publish: `publish` — Publishing & Social Accounts

Manage social media accounts and publishing.

```bash
orion publish accounts
orion publish history
```

---

## :material-shield-account: `admin` — Admin Operations

Administrative operations like seeding and cleanup.

```bash
orion admin seed
orion admin cleanup
orion admin cleanup --days 30
orion admin seed-demo
```

---

## :material-wrench: Development

```bash
# Run CLI tests
make cli-test

# Lint CLI code
make cli-lint

# Build distributable wheel
make cli-build
```
