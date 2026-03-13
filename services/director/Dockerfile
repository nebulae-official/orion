# --- builder stage ---
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.6 /uv /usr/local/bin/uv

WORKDIR /app

COPY libs/orion-common/ /app/libs/orion-common/
COPY services/director/pyproject.toml .
RUN sed -i 's|file:../../libs/orion-common|file:///app/libs/orion-common|' pyproject.toml
RUN uv pip install --system -e .
COPY services/director/ .

# --- dev stage (hot-reload with uvicorn --reload) ---
FROM builder AS dev

WORKDIR /app

EXPOSE 8002

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]

# --- runtime stage ---
FROM python:3.13-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/ /app/

RUN addgroup --system orion && adduser --system --ingroup orion orion
USER orion

EXPOSE 8002

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]
