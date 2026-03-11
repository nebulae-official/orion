---
description: Python service development rules for Orion microservices
globs: ["services/**/*.py", "libs/**/*.py"]
---

# Python Services Rules

## Framework & Libraries
- FastAPI for all HTTP endpoints
- Pydantic v2 for request/response models and settings
- SQLAlchemy 2.0 with async sessions for database access
- structlog for structured logging (not stdlib logging)
- Redis for pub/sub messaging between services

## Code Style
- Type hints on ALL function signatures (params and return)
- Async functions for I/O operations (async def, await)
- Use Annotated types with FastAPI Depends for dependency injection
- Repository pattern: routes -> service -> repository -> database
- No business logic in route handlers — delegate to service layer

## Data Models
- All request/response bodies are Pydantic BaseModel subclasses
- Use Field() for validation constraints
- model_config = ConfigDict(from_attributes=True) for ORM models
- Settings classes inherit from pydantic_settings.BaseSettings

## Error Handling
- Raise HTTPException with appropriate status codes
- Custom exception handlers for domain errors
- Never catch broad Exception without re-raising or logging

## Testing
- pytest with async support (pytest-asyncio)
- Fixtures for database sessions, Redis connections, FastAPI test client
- Minimum 80% coverage target
- Tests in tests/ directory mirroring src/ structure

## Linting
- ruff for linting and import sorting
- black for formatting (line-length 88)
- mypy for type checking (strict mode)

## FastAPI Patterns
- Use Depends() for injection; Pydantic for request/response schemas
- Central exception handlers; return consistent error JSON
- Health: GET /health (liveness), GET /ready (dependencies)
- Use APIRouter; mount at prefix in main app
