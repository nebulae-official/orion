"""Factory for creating the configured LLM provider."""

from __future__ import annotations

import os

import structlog

from orion_common.config import CommonSettings

from .base import LLMProvider
from .cloud import CloudLLMProvider
from .ollama import OllamaProvider

logger = structlog.get_logger(__name__)


def get_llm_provider(settings: CommonSettings) -> LLMProvider:
    """Return the LLM provider indicated by ``DIRECTOR_LLM_PROVIDER``.

    Supported values (case-insensitive):
    - ``LOCAL`` (default) — Ollama running on ``settings.ollama_host``
    - ``CLOUD`` — OpenAI-compatible cloud API
    """
    provider_type = os.getenv("DIRECTOR_LLM_PROVIDER", "LOCAL").upper()

    if provider_type == "CLOUD":
        logger.info("llm_provider_selected", provider="cloud")
        return CloudLLMProvider()

    logger.info("llm_provider_selected", provider="ollama")
    model = os.getenv("DIRECTOR_OLLAMA_MODEL", "deepseek-r1:8b")
    return OllamaProvider(host=settings.ollama_host, model=model)
