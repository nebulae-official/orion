# --- builder stage ---
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /app

# Copy shared library first
COPY libs/orion-common/ /app/libs/orion-common/

# Copy service dependency manifest
COPY services/scout/pyproject.toml /app/pyproject.toml

# Override local path dep for container context
ENV UV_LINK_MODE=copy
RUN uv pip install --system --prefix /install \
    "orion-common @ file:///app/libs/orion-common" && \
    uv pip install --system --prefix /install -e .

COPY services/scout/ /app/

# --- runtime stage ---
FROM python:3.13-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --from=builder /app/ /app/

# Add non-root user
RUN addgroup --system orion && adduser --system --ingroup orion orion
USER orion

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
