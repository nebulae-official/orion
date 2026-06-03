"""Shared e2e fixtures: session-scoped Postgres + Redis containers.

All e2e tests share the same testcontainer instances via this conftest so that
only one container pair is started per test run, keeping the suite fast.
"""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer


@pytest.fixture(scope="session")
def e2e_postgres():
    with PostgresContainer("postgres:17") as pg:
        yield pg


@pytest.fixture(scope="session")
def e2e_redis():
    with RedisContainer("redis:7.4") as redis:
        yield redis


@pytest.fixture(scope="session")
def e2e_postgres_url(e2e_postgres: PostgresContainer) -> str:
    return e2e_postgres.get_connection_url().replace("psycopg2", "asyncpg")


@pytest.fixture(scope="session")
def e2e_redis_url(e2e_redis: RedisContainer) -> str:
    host = e2e_redis.get_container_host_ip()
    port = e2e_redis.get_exposed_port(6379)
    return f"redis://{host}:{port}"


@pytest.fixture(scope="session")
def e2e_engine(e2e_postgres_url: str):
    engine = create_async_engine(e2e_postgres_url, echo=False, poolclass=NullPool)

    async def _create_tables() -> None:
        from orion_common.db.models import Base

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_tables())
    yield engine
    asyncio.run(engine.dispose())


@pytest.fixture(scope="session")
def e2e_session_factory(e2e_engine):
    return async_sessionmaker(e2e_engine, expire_on_commit=False)
