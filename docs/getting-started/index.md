# Getting Started

Welcome to Orion — the Digital Twin Content Agency. Orion is a distributed platform of autonomous AI agents that detect trending topics, generate written and visual content, and publish it across social media channels — all without manual intervention.

This section walks you through setting up a local development environment, launching the full service stack, running your first content pipeline, and configuring every aspect of the platform.

## :material-map: Roadmap

1. **[Installation](installation.md)** — Install all prerequisites, clone the repository, and set up each layer of the stack
2. **[Quickstart](quickstart.md)** — Launch all services and trigger your first trend scan through the complete pipeline
3. **[Configuration](configuration.md)** — Customize environment variables, service settings, rate limits, and AI provider options
4. **[Troubleshooting](troubleshooting.md)** — Diagnose and resolve common issues with Docker, networking, auth, and builds

## :material-check-circle: Prerequisites

| Requirement    | Minimum Version | Purpose                                  |
| -------------- | --------------- | ---------------------------------------- |
| Docker         | 24.x            | Container runtime for all services       |
| Docker Compose | 2.20+           | Multi-container orchestration            |
| Go             | 1.24            | Gateway development                      |
| Python         | 3.13            | AI microservices and CLI                 |
| Node.js        | 22 LTS          | Dashboard frontend                       |
| uv             | latest          | Python package management (replaces pip) |
| Make           | any             | Build automation                         |

### Verify your environment

```bash
# Check all prerequisites at once
docker --version        # Docker 24.x+
docker compose version  # Docker Compose 2.20+
go version              # go1.24.x
python3 --version       # Python 3.13.x
node --version          # v22.x.x
uv --version            # uv 0.x.x
make --version          # GNU Make 4.x
```

Or use the automated setup script which checks everything for you:

```bash
./scripts/setup.sh
```

!!! tip "Docker-only setup"
If you only need to **run** Orion (not develop it), Docker and Docker Compose are the only requirements. All services run in containers and no local Go, Python, or Node.js installation is needed.

## :material-clock-fast: Fastest path to a running system

```bash
# Clone, configure, and launch — three commands
git clone https://github.com/orion-platform/orion.git && cd orion
cp .env.example .env
docker compose -f deploy/docker-compose.yml up -d

# Verify everything is healthy
curl http://localhost:8000/health
```
