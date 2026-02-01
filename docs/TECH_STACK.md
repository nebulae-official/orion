# Orion Tech Stack (Official Stable Versions)

**Rule:** Use official stable releases only. No alpha, beta, RC, canary, or preview versions.

| Technology | Version | Notes |
| ---------- | ------- | ----- |
| **Python** | 3.14.x | Latest stable (free-threaded, t-strings) |
| **FastAPI** | 0.128.x | Pydantic v2 only |
| **Pydantic** | 2.12.x | Data validation, settings |
| **LangGraph** | 1.x | Agent orchestration (stable API) |
| **Next.js** | 15.5.x | App Router (NOT v16 canary) |
| **React** | 19.x | Server Components |
| **Tailwind CSS** | 4.1.x | CSS-first config |
| **PostgreSQL** | 18.x | Async I/O subsystem |
| **Redis** | 8.4.x | Stable (NOT 8.6-RC) |
| **Docker Compose** | 2.x | Compose spec v3.9 |
| **Node.js** | 22.x LTS | Long-term support |

## Python Services

- `requires-python = ">=3.14"`
- FastAPI 0.128.x, Pydantic 2.12.x, LangGraph 1.x
- Ruff for linting

## Dashboard

- Next.js 15.5.x (App Router)
- React 19.x, Tailwind CSS 4.1.x
- TypeScript 5.x

## Infrastructure

- PostgreSQL 18.x, Redis 8.4.x
- Docker multi-stage builds, non-root users
