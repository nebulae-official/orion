# Project Orion

**Digital Twin Creative Agency** — autonomous short-form video content pipeline from trends to published video.

## Overview

Orion is a microservices-based system that produces 3+ short-form videos per day with minimal human intervention. Confluence holds architecture and operations docs; Jira holds the backlog.

## Links

| Resource | Link |
| -------- | ---- |
| **Jira Backlog** | [ORION Project](https://gishantsngh.atlassian.net/jira/software/projects/ORION/) |
| **Confluence** | [Orion Space](https://gishantsngh.atlassian.net/wiki/spaces/ORION) |
| **Tech Stack** | [docs/TECH_STACK.md](docs/TECH_STACK.md) |

## Repo Structure

```
orion/
├── services/     # Python microservices (gateway, scout, director, media, editor, pulse)
├── dashboard/    # Next.js frontend
├── shared/       # Shared Python packages
├── workflows/    # ComfyUI workflow JSONs
├── scripts/      # Utility scripts
└── docs/         # Developer documentation
```

## Quick Start

```bash
# Copy environment
cp .env.example .env
# Edit .env with your API keys

# Run (when Docker setup is ready)
make dev
```

## Branching & Commits

- **Branch:** `feature/ORION-{id}-{slug}` or `fix/ORION-{id}-{slug}`
- **Commit:** `ORION-{id}: {type}: {description}` (e.g. `ORION-15: feat: add ComfyUI client`)

## Tech Stack

See [docs/TECH_STACK.md](docs/TECH_STACK.md) for official stable versions. We use **stable releases only** (no beta/RC/canary).