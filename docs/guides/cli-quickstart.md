# :lucide-terminal: CLI Quickstart

Get started with the Orion command-line interface for managing the platform from your terminal.

---

## :lucide-download: Installation

The CLI is built with Go and managed with uv for the Python integration layer. Install it from the project root:

```bash
cd cli
uv sync
```

Verify the installation:

```bash
uv run orion --help
```

---

## :lucide-lock: Authentication

Log in to the Orion Gateway:

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
User:  admin
Email: admin@orion.local
Role:  admin
```

!!! tip "Session Persistence"
    Your auth token is stored in `~/.orion/token` and persists between terminal sessions. You only need to log in again when the token expires or the gateway URL changes.

---

## :lucide-list: Common Commands

=== "Trend Management"

    | Command | Description |
    | --- | --- |
    | `orion scout trigger` | Trigger a trend scan |
    | `orion scout list-trends` | List all detected trends |
    | `orion scout configure <niche>` | Configure active niche (tech, gaming, finance) |

=== "Content Management"

    | Command | Description |
    | --- | --- |
    | `orion content list` | List all content items |
    | `orion content view <id>` | View content details |
    | `orion content approve <id>` | Approve content for publishing |
    | `orion content reject <id>` | Reject content |
    | `orion content regenerate <id>` | Regenerate content |

=== "Publishing"

    | Command | Description |
    | --- | --- |
    | `orion publish send <id> --platform twitter` | Publish to a platform |
    | `orion publish accounts` | List connected social accounts |
    | `orion publish history` | View publishing history |

=== "System"

    | Command | Description |
    | --- | --- |
    | `orion system health` | Check service health |
    | `orion system status` | Show status of all services |

=== "Administration"

    | Command | Description |
    | --- | --- |
    | `orion admin seed` | Seed the database with sample data |
    | `orion admin cleanup` | Run data cleanup |
    | `orion admin seed-demo` | Generate demo fixtures |

---

## :lucide-file-output: Output Formats

Most commands support multiple output formats via the `--format` flag:

```bash
orion scout list-trends --format table   # Default: human-readable table
orion scout list-trends --format json    # Machine-readable JSON
orion scout list-trends --format plain   # Plain text, one item per line
```

!!! tip "Scripting with JSON Output"
    Use `--format json` combined with `jq` for powerful scripting. For example: `orion content list --format json | jq '.[].id'` to extract content IDs.

---

## :lucide-wrench: Configuration

The CLI reads configuration from these sources (in order of priority):

1. Command-line flags (`--gateway-url`, `--format`)
2. Environment variables (`ORION_GATEWAY_URL`, `ORION_FORMAT`)
3. Config file (`~/.orion/config.yaml`)

### :lucide-link: Setting the Gateway URL

```bash
# Via environment variable
export ORION_GATEWAY_URL=http://localhost:8000
```

The gateway URL can also be set in the config file at `~/.orion/config.toml`.

---

## :lucide-arrow-right: Next Steps

- **[Dashboard Overview](dashboard-overview.md)** -- Use the web dashboard instead
- **[Content Workflow](content-workflow.md)** -- Understand the content pipeline
- **[CLI Workflow Demo](demo-cli-workflow.md)** -- Full end-to-end CLI walkthrough
- **[System Administration](system-admin.md)** -- Service health and provider management
