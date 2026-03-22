"""Factory for creating the configured LLM provider."""

from __future__ import annotations

import os

import structlog
from orion_common.config import CommonSettings

from .base import LLMProvider
from .cloud import CloudLLMProvider
from .ollama import OllamaProvider

logger = structlog.get_logger(__name__)


def get_llm_provider(
    settings: CommonSettings,
    user_preferences: dict[str, str] | None = None,
) -> LLMProvider:
    """Return the LLM provider indicated by ``DIRECTOR_LLM_PROVIDER``.

    If *user_preferences* contains ``llm_provider``, it takes precedence
    over the environment variable.  Falls back to the env var otherwise.

    Supported values (case-insensitive):
    - ``LOCAL`` (default) — Ollama running on ``settings.ollama_host``
    - ``CLOUD`` — OpenAI-compatible cloud API
    """
    prefs = user_preferences or {}
    provider_type = prefs.get(
        "llm_provider", os.getenv("DIRECTOR_LLM_PROVIDER", "LOCAL")
    ).upper()
    source = "user_pref" if "llm_provider" in prefs else "env"

    if provider_type == "CLOUD":
        logger.info("llm_provider_selected", provider="cloud", source=source)
        return CloudLLMProvider()

    logger.info("llm_provider_selected", provider="ollama", source=source)
    model = prefs.get("llm_model", os.getenv("DIRECTOR_OLLAMA_MODEL", "deepseek-r1:8b"))
    return OllamaProvider(host=settings.ollama_host, model=model)
