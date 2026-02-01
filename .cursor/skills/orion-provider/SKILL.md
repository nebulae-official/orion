---
name: orion-provider
description: Add LOCAL/CLOUD provider using Strategy pattern. Use when adding a new provider (LLM, image, video, TTS, STT).
---

# Orion Provider

- Define abstract interface (e.g. ImageProvider) with methods (generate, etc.).
- Implement LOCAL and CLOUD strategies; select via config (pydantic-settings).
- Use factory or dependency injection to resolve implementation.
- Log provider switches; support fallback chain on failure.
