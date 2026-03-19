# --- builder stage ---
FROM python:3.14-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.6 /uv /usr/local/bin/uv

WORKDIR /app

# Copy shared library first
COPY libs/orion-common/ /app/libs/orion-common/

# Copy service files
COPY services/scout/pyproject.toml .

# Rewrite the local path dep so uv can resolve it in the container
RUN sed -i 's|file:../../libs/orion-common|file:///app/libs/orion-common|' pyproject.toml && \
    sed -i '/\[tool\.uv\.sources\]/,/^$/d' pyproject.toml

RUN uv pip install --system -e /app/libs/orion-common -e .

COPY services/scout/ .

# --- dev stage (hot-reload with uvicorn --reload) ---
FROM builder AS dev

WORKDIR /app

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# --- runtime stage ---
FROM python:3.14-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --from=builder /app/ /app/

# Add non-root user
RUN addgroup --system orion && adduser --system --ingroup orion orion
USER orion

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
