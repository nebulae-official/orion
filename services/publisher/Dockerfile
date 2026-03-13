# --- builder stage ---
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /app

COPY libs/orion-common/ /app/libs/orion-common/
COPY services/publisher/pyproject.toml /app/pyproject.toml

ENV UV_LINK_MODE=copy
RUN uv pip install --system --prefix /install \
    "orion-common @ file:///app/libs/orion-common" && \
    uv pip install --system --prefix /install -e .

COPY services/publisher/ /app/

# --- runtime stage ---
FROM python:3.13-slim

WORKDIR /app

COPY --from=builder /install /usr/local
COPY --from=builder /app/ /app/

RUN addgroup --system orion && adduser --system --ingroup orion orion
USER orion

EXPOSE 8006

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8006"]
