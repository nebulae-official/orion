# Orion — Digital Twin Content Agency

Orion is an autonomous content platform that monitors trends, generates written and visual content using local AI models, and publishes it — all orchestrated by a swarm of specialized microservices.

## Overview

Orion combines a high-performance Go API gateway with Python AI microservices and a Next.js dashboard to create a fully automated content production pipeline.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js Dashboard  (port 3000)                 │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│  Go Gateway  (port 8000)                        │
│  cmd/gateway — routing, auth, event fanout      │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Scout :8001  │ │Director:8002 │ │ Media :8003  │
│ trend detect │ │ orchestrate  │ │ img generate │
└──────────────┘ └──────────────┘ └──────────────┘
        ┌───────────────┼
        ▼               ▼
┌──────────────┐ ┌──────────────┐
│ Editor :8004 │ │ Pulse :8005  │
│ LLM writing  │ │ analytics    │
└──────────────┘ └──────────────┘
```

## Getting Started

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Install dependencies
./scripts/setup.sh

# 3. Run the gateway
make run
```

## Services

| Service  | Port | Description                          |
|----------|------|--------------------------------------|
| gateway  | 8000 | Go HTTP gateway, routes all traffic  |
| scout    | 8001 | Trend detection and signal scoring   |
| director | 8002 | Pipeline orchestration               |
| media    | 8003 | Image generation via ComfyUI         |
| editor   | 8004 | Text generation via Ollama           |
| pulse    | 8005 | Analytics and performance tracking   |
| dashboard| 3000 | Next.js operator dashboard           |

## Development

```bash
# Go
make build     # build gateway + cli
make test      # run Go tests
make lint      # golangci-lint

# Python (per service)
cd services/scout
pip install -e .
uvicorn src.main:app --reload --port 8001

# Dashboard
cd dashboard
npm install
npm run dev
```

## Tech Stack

- **Gateway/CLI:** Go 1.24
- **AI Services:** Python 3.13, FastAPI, Uvicorn
- **Dashboard:** Next.js 15.2, React 19, Tailwind CSS 4
- **AI Models:** Ollama (LLM), ComfyUI (images)
- **Vector DB:** Milvus
- **Database:** PostgreSQL + SQLAlchemy
- **Cache/Queue:** Redis

See [docs/TECH_STACK.md](docs/TECH_STACK.md) for full version details.
