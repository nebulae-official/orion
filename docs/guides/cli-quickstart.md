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
Username: admin
Password: ****
Logged in successfully. Token stored in ~/.orion/token
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
    | `orion scout trigger --sources google,rss --regions US` | Trigger a trend scan |
    | `orion trends list` | List all detected trends |
    | `orion trends list --status new` | List only new (unused) trends |

=== "Content Management"

    | Command | Description |
    | --- | --- |
    | `orion content list` | List all content items |
    | `orion content list --status review` | Filter by status |
    | `orion content show <id>` | View content details |
    | `orion content approve <id>` | Approve content for publishing |
    | `orion content reject <id>` | Reject content |

=== "Publishing"

    | Command | Description |
    | --- | --- |
    | `orion publish <id> --platforms youtube,twitter` | Publish to platforms |
    | `orion publish history` | View publishing history |

=== "System"

    | Command | Description |
    | --- | --- |
    | `orion health` | Check service health |
    | `orion gpu status` | View GPU utilization |
    | `orion config show` | Show current provider configuration |
    | `orion config set llm --provider cloud --model gpt-4` | Change a provider |

=== "Administration"

    | Command | Description |
    | --- | --- |
    | `orion admin seed` | Seed the database with initial data |
    | `orion admin reset` | Reset the database (destructive) |

---

## :lucide-file-output: Output Formats

Most commands support multiple output formats via the `--format` flag:

```bash
orion trends list --format table   # Default: human-readable table
orion trends list --format json    # Machine-readable JSON
orion trends list --format plain   # Plain text, one item per line
```

!!! tip "Scripting with JSON Output"
    Use `--format json` combined with `jq` for powerful scripting. For example: `orion content list --status review --format json | jq '.[].id'` to extract content IDs awaiting review.

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

# Via config file
orion config set gateway-url http://localhost:8000
```

---

## :lucide-arrow-right: Next Steps

- **[Dashboard Overview](dashboard-overview.md)** -- Use the web dashboard instead
- **[Content Workflow](content-workflow.md)** -- Understand the content pipeline
- **[CLI Workflow Demo](demo-cli-workflow.md)** -- Full end-to-end CLI walkthrough
- **[System Administration](system-admin.md)** -- Service health and provider management
