"""Social account management endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import SocialAccount
from orion_common.db.session import get_session

from src.repositories.publish_repo import PublishRepository
from src.schemas import SocialAccountCreate, SocialAccountResponse
from src.services.crypto import encrypt_credentials

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("/", response_model=SocialAccountResponse, status_code=201)
async def add_account(
    body: SocialAccountCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SocialAccount:
    """Connect a new social media account."""
    repo = PublishRepository(session)
    account = SocialAccount(
        platform=body.platform,
        display_name=body.display_name,
        credentials=encrypt_credentials(body.credentials),
    )
    created = await repo.create_account(account)
    await session.commit()
    return created


@router.get("/", response_model=list[SocialAccountResponse])
async def list_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SocialAccount]:
    """List connected social accounts (credentials redacted)."""
    repo = PublishRepository(session)
    return await repo.list_accounts()


@router.delete("/{account_id}", status_code=204)
async def remove_account(
    account_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Disconnect a social account."""
    repo = PublishRepository(session)
    deleted = await repo.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")
    await session.commit()
