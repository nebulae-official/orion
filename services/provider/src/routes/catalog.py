"""Catalog discovery route — exposes registered provider/capability entries.

GET /api/v1/providers returns all catalog entries without any credential data.
This is a read-only introspection endpoint for clients that need to know which
providers and capabilities are available before making a request.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from src.catalog import Capability, CredentialKind, list_entries

router = APIRouter(prefix="/api/v1/providers", tags=["catalog"])


class ProviderEntryResponse(BaseModel):
    provider: str
    capability: Capability
    credential_kind: CredentialKind
    default_model: str
    base_url: str
    default_voice: str | None = None


@router.get("", response_model=list[ProviderEntryResponse])
async def list_providers() -> list[ProviderEntryResponse]:
    """Return all registered (provider, capability) catalog entries.

    No credentials or API keys are included in the response.
    """
    return [
        ProviderEntryResponse(
            provider=e.provider,
            capability=e.capability,
            credential_kind=e.credential_kind,
            default_model=e.default_model,
            base_url=e.base_url,
            default_voice=e.default_voice,
        )
        for e in list_entries()
    ]
