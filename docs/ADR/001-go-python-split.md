# ADR 001: Go for Gateway/CLI, Python for AI Services

**Date:** 2026-03-11
**Status:** Accepted

## Context

Orion requires two distinct performance profiles:

1. **High-throughput routing** — The API gateway must handle many concurrent HTTP requests, fan events out to multiple services, and add minimal latency.
2. **AI workload execution** — Services that call LLMs (Ollama) and image generators (ComfyUI) are IO-bound and benefit from Python's rich ML ecosystem and async primitives.

## Decision

Use **Go** for the API gateway and CLI. Use **Python** for all AI microservices.

## Rationale

### Go (gateway, cli)
- Single binary deployment with minimal startup time
- Excellent standard library for HTTP servers (`net/http`)
- Low memory footprint under high concurrency
- Strong typing catches integration bugs at compile time
- No runtime dependencies for deployment

### Python (services)
- First-class libraries for AI/ML (transformers, torch, diffusers)
- FastAPI provides async HTTP with automatic OpenAPI docs
- Pydantic v2 for fast data validation across service boundaries
- Easier iteration on prompts and model integrations
- Large ecosystem for data processing (pandas, numpy, etc.)

## Consequences

**Positive:**
- Each layer is optimized for its workload
- Teams can choose the best tool per domain
- Go gateway acts as a stable, typed API contract
- Python services can evolve independently

**Negative:**
- Two language ecosystems to maintain (Go toolchain + Python venvs)
- No shared type system across the boundary — API contracts enforced by OpenAPI/JSON
- Developers need proficiency in both languages

## Alternatives Considered

- **All Go:** Feasible but Go AI library ecosystem is immature compared to Python
- **All Python:** FastAPI could handle routing, but Python's concurrency model (GIL) is less suited for a high-throughput gateway
- **Node.js gateway:** More familiar for frontend developers but heavier memory footprint than Go
