"""Mock ComfyUI server — returns a test image for any workflow."""

import base64
from fastapi import FastAPI

app = FastAPI(title="Mock ComfyUI Server")

TEST_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/prompt")
async def prompt() -> dict:
    return {"prompt_id": "mock-prompt-001"}


@app.get("/api/history/{prompt_id}")
async def history(prompt_id: str) -> dict:
    return {
        prompt_id: {
            "status": {"completed": True},
            "outputs": {"images": [{"filename": "test.png", "type": "output"}]},
        }
    }


@app.get("/api/view")
async def view():
    from fastapi.responses import Response
    return Response(content=TEST_PNG, media_type="image/png")
