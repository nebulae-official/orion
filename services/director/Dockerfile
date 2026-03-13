FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY libs/orion-common/ /app/libs/orion-common/
COPY services/director/pyproject.toml .
RUN sed -i 's|file:../../libs/orion-common|file:///app/libs/orion-common|' pyproject.toml
RUN uv pip install --system -e .
COPY services/director/ .

EXPOSE 8002

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]
