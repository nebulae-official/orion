"""Mock TTS server — returns a silent WAV file."""

import struct
from fastapi import FastAPI
from fastapi.responses import Response

app = FastAPI(title="Mock TTS Server")


def _silent_wav(duration_ms: int = 500, sample_rate: int = 16000) -> bytes:
    """Generate a silent WAV file."""
    num_samples = int(sample_rate * duration_ms / 1000)
    data_size = num_samples * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/v1/text-to-speech/{voice_id}")
async def tts(voice_id: str) -> Response:
    return Response(content=_silent_wav(), media_type="audio/wav")
