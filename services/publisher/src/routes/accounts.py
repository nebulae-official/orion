"""Social account management endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from orion_common.auth import CurrentUser, get_current_user
from orion_common.db.models import SocialAccount
from orion_common.db.session import get_session
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.publish_repo import PublishRepository
from src.schemas import SocialAccountCreate, SocialAccountResponse
from src.services.crypto import encrypt_credentials

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("/", response_model=SocialAccountResponse, status_code=201)
async def add_account(
    body: SocialAccountCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
) -> SocialAccount:
    """Connect a new social media account."""
    repo = PublishRepository(session)
    account = SocialAccount(
        platform=body.platform,
        display_name=body.display_name,
        credentials=encrypt_credentials(body.credentials),
        user_id=UUID(user.user_id),
    )
    created = await repo.create_account(account)
    await session.commit()
    return created


@router.get("/", response_model=list[SocialAccountResponse])
async def list_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
) -> list[SocialAccount]:
    """List connected social accounts (credentials redacted)."""
    repo = PublishRepository(session)
    scope_user_id = None if user.is_admin else UUID(user.user_id)
    return await repo.list_accounts(user_id=scope_user_id)


@router.delete("/{account_id}", status_code=204)
async def remove_account(
    account_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Disconnect a social account."""
    repo = PublishRepository(session)
    account = await repo.get_account(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not user.is_admin and account.user_id is not None and str(account.user_id) != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorised to delete this account")
    deleted = await repo.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")
    await session.commit()
