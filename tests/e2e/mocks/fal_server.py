"""Mock Fal.ai server — returns deterministic image/video results."""

import base64
from fastapi import FastAPI

app = FastAPI(title="Mock Fal.ai Server")

TEST_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/fal-ai/flux/dev")
@app.post("/fal-ai/stable-video")
async def generate() -> dict:
    return {
        "images": [{"url": "http://mock-fal:9004/test.png", "content_type": "image/png"}],
        "video": {"url": "http://mock-fal:9004/test.mp4"},
    }


@app.get("/test.png")
async def test_image():
    from fastapi.responses import Response
    return Response(content=TEST_PNG, media_type="image/png")
