FROM python:3.13-slim

WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn[standard]
# Note: pip is intentional here — this is a throwaway container, not part of the UV workspace
COPY *.py .

# Entrypoint expects SERVER_MODULE env var (e.g., "llm_server:app")
CMD ["sh", "-c", "uvicorn ${SERVER_MODULE} --host 0.0.0.0 --port ${SERVER_PORT:-8080}"]
