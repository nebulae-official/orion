FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY libs/orion-common/ /app/libs/orion-common/
COPY services/pulse/pyproject.toml .
RUN sed -i 's|file:../../libs/orion-common|file:///app/libs/orion-common|' pyproject.toml
RUN uv pip install --system -e .
COPY services/pulse/ .

EXPOSE 8005

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8005"]
