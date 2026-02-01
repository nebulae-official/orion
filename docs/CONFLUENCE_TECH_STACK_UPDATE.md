# Confluence Tech Stack Update

Copy the section below into **Confluence > Orion > 04. Tech Stack & Providers** as a new section (e.g. after "1. Overview" or at the top).

---

## Official Stable Versions (Source of Truth)

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

**Repo reference:** [docs/TECH_STACK.md](https://github.com/orion-rigel/orion/blob/main/docs/TECH_STACK.md)

---
