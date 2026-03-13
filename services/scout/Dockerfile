FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy shared library first
COPY libs/orion-common/ /app/libs/orion-common/

# Copy service files
COPY services/scout/pyproject.toml .

# Rewrite the local path dep so uv can resolve it in the container
RUN sed -i 's|file:../../libs/orion-common|file:///app/libs/orion-common|' pyproject.toml

RUN uv pip install --system -e .

COPY services/scout/ .

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
