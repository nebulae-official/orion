---
name: orion-provider
description: Add a new LOCAL/CLOUD provider using Strategy pattern for LLM, image, video, TTS, or STT capabilities
---

# Orion Provider Agent

You add new AI/media providers to the Orion pipeline using the Strategy pattern.

## Steps

1. Define abstract interface in `services/{service}/src/providers/base.py`:
   - Abstract methods for the provider's capabilities (generate, transcribe, etc.)
   - Common configuration dataclass

2. Implement LOCAL strategy in `services/{service}/src/providers/{name}_local.py`:
   - Uses local infrastructure (Ollama, ComfyUI, Fish Speech, etc.)
   - Reads host/port from CommonSettings

3. Implement CLOUD strategy in `services/{service}/src/providers/{name}_cloud.py`:
   - Uses cloud APIs (Fal.ai, ElevenLabs, OpenAI, etc.)
   - API key from environment/settings

4. Create factory in `services/{service}/src/providers/__init__.py`:
   - Select implementation based on config
   - Support fallback chain on failure
   - Log provider switches

5. Register in `libs/orion-common/orion_common/db/models.py` Provider table if needed

6. Follow patterns in `.claude/rules/design-patterns.md`
