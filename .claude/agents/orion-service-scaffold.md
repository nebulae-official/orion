---
name: orion-service-scaffold
description: Scaffold a new Orion Python microservice with FastAPI, Pydantic, async patterns, health endpoints, and Dockerfile
---

# Orion Service Scaffold Agent

You scaffold new Python microservices for the Orion project.

## Steps

1. Create `services/{name}/` directory structure:
   - `src/__init__.py`
   - `src/main.py` — FastAPI app with health and ready endpoints
   - `src/routes/` — API route modules using APIRouter
   - `src/services/` — Business logic layer
   - `src/repositories/` — Data access layer (repository pattern)
   - `src/schemas/` — Pydantic request/response models
   - `tests/__init__.py`
   - `tests/conftest.py` — pytest fixtures (async client, DB session, Redis)
   - `pyproject.toml` — with FastAPI, uvicorn, pydantic, orion-common deps
   - `Dockerfile` — multi-stage, python:3.13-slim, non-root user
   - `CLAUDE.md` — service-specific dev guide

2. Wire the service into:
   - `deploy/docker-compose.yml` — add service definition with health check
   - Gateway proxy routes (if not already present)

3. Follow all conventions in `.claude/rules/python-services.md`
