# Media Service

Generates images and other media assets using ComfyUI and local diffusion models.

## Dev

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8003
```

## Responsibilities
- Accept media generation requests with prompts and parameters
- Interface with ComfyUI at `COMFYUI_HOST`
- Store generated assets and emit `MediaGenerated` events
