"""Async SQLAlchemy session factory for Orion services."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from orion_common.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    """Return (and lazily create) the global async engine."""
    global _engine  # noqa: PLW0603
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.debug,
            pool_pre_ping=True,
        )
    return _engine


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return (and lazily create) the global session factory."""
    global _session_factory  # noqa: PLW0603
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=_get_engine(),
            expire_on_commit=False,
        )
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session; suitable as a FastAPI dependency.

    Usage::

        @app.get("/items")
        async def list_items(session: AsyncSession = Depends(get_session)):
            ...
    """
    factory = _get_session_factory()
    async with factory() as session:
        yield session


def get_engine() -> AsyncEngine:
    """Public accessor for the async engine (e.g. for Alembic)."""
    return _get_engine()
