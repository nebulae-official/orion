"""Mock LLM server — returns deterministic script responses."""

from fastapi import FastAPI, Request

app = FastAPI(title="Mock LLM Server")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/generate")
@app.post("/v1/chat/completions")
async def generate(request: Request) -> dict:
    """Return a deterministic script response regardless of prompt."""
    return {
        "choices": [
            {
                "message": {
                    "content": (
                        "Hook: AI is transforming how developers write code.\n"
                        "Visual: A developer using an AI coding assistant.\n"
                        "CTA: Subscribe for more tech insights."
                    )
                }
            }
        ]
    }
