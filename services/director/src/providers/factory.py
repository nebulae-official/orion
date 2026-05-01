from __future__ import annotations

import structlog
from orion_common.config import CommonSettings

from .provider_client import ProviderServiceClient

logger = structlog.get_logger(__name__)


def get_llm_provider(
    settings: CommonSettings,
    user_preferences: dict | None = None,
) -> ProviderServiceClient:
    logger.info("llm_provider_selected", provider="provider_service")
    return ProviderServiceClient()
