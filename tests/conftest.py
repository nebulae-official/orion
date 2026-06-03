"""Session-scoped container fixtures shared across e2e tests."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:17") as pg:
        yield pg


@pytest.fixture(scope="session")
def redis_container():
    with RedisContainer("redis:7.4") as redis:
        yield redis


@pytest.fixture(scope="session")
def postgres_url(postgres_container: PostgresContainer) -> str:
    return postgres_container.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture(scope="session")
def redis_url(redis_container: RedisContainer) -> str:
    host = redis_container.get_container_host_ip()
    port = redis_container.get_exposed_port(6379)
    return f"redis://{host}:{port}"


@pytest.fixture(scope="session")
def db_engine(postgres_url: str):
    engine = create_async_engine(postgres_url, echo=False, poolclass=NullPool)

    async def _create_tables() -> None:
        from orion_common.db.models import Base

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_tables())
    yield engine
    asyncio.run(engine.dispose())


@pytest.fixture(scope="session")
def session_factory(db_engine):
    return async_sessionmaker(db_engine, expire_on_commit=False)
