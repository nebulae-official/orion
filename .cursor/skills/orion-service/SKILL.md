---
name: orion-service
description: Scaffold a new Orion microservice with modern patterns (Repository, DI, async). Use when adding a new service under services/.
---

# Orion Service Scaffold

- Create services/{name}/ with app/main.py, app/__init__.py.
- Use FastAPI, Pydantic, async; add GET /health and GET /ready.
- Add requirements.txt with FastAPI, Pydantic, uvicorn; Python >=3.14.
- Add Dockerfile (multi-stage, non-root); pin python:3.14-slim.
- Follow patterns in docs/TECH_STACK.md and .cursor/rules.
