from __future__ import annotations

from pydantic import BaseModel


class LLMCompleteRequest(BaseModel):
    prompt: str
    system_prompt: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2048
    model: str | None = None
    provider: str | None = None  # override catalog default; None → "nvidia_nim"


class LLMCompleteResponse(BaseModel):
    content: str
    model: str
    usage: dict | None = None


class ImageGenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str | None = None
    width: int = 1024
    height: int = 1024
    steps: int = 25
    seed: int | None = None
    model: str | None = None
    provider: str | None = None  # override catalog default; None → "nvidia_nim"


class ImageGenerateResponse(BaseModel):
    image_b64: str
    provider: str
    width: int
    height: int
    seed: int | None = None


class TTSGenerateRequest(BaseModel):
    text: str
    voice: str = "Magpie-Multilingual.EN-US.Aria"
    speed: float = 1.0
    response_format: str = "wav"
    model: str | None = None
    provider: str | None = None  # override catalog default; None → "nvidia_nim"


class TTSGenerateResponse(BaseModel):
    audio_b64: str
    provider: str
    format: str
