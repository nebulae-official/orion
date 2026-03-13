"""Tests for OrionSettings / CommonSettings loading."""

from __future__ import annotations

import os
from unittest.mock import patch

from orion_common.config import CommonSettings


def test_default_settings() -> None:
    """CommonSettings should load with sensible defaults."""
    with patch.dict(os.environ, {}, clear=True):
        settings = CommonSettings()
    assert settings.app_env == "development"
    assert settings.app_name == "orion"
    assert settings.debug is False
    assert settings.postgres_host == "localhost"
    assert settings.postgres_port == 5432
    assert settings.redis_url == "redis://localhost:6379"
    assert settings.milvus_host == "localhost"
    assert settings.milvus_port == 19530


def test_database_url_format() -> None:
    """database_url should use the asyncpg driver."""
    with patch.dict(os.environ, {}, clear=True):
        settings = CommonSettings()
    url = settings.database_url
    assert url.startswith("postgresql+asyncpg://")
    assert "orion" in url


def test_database_url_sync_format() -> None:
    """database_url_sync should use the default psycopg driver."""
    with patch.dict(os.environ, {}, clear=True):
        settings = CommonSettings()
    url = settings.database_url_sync
    assert url.startswith("postgresql://")
    assert "asyncpg" not in url


def test_env_override() -> None:
    """Settings should be overridable via environment variables."""
    overrides = {
        "APP_ENV": "production",
        "DEBUG": "true",
        "POSTGRES_HOST": "db.prod.example.com",
        "REDIS_URL": "redis://redis.prod:6379/1",
    }
    with patch.dict(os.environ, overrides, clear=True):
        settings = CommonSettings()
    assert settings.app_env == "production"
    assert settings.debug is True
    assert settings.postgres_host == "db.prod.example.com"
    assert settings.redis_url == "redis://redis.prod:6379/1"


def test_database_url_includes_credentials() -> None:
    """database_url should embed the configured user and password."""
    overrides = {
        "POSTGRES_USER": "myuser",
        "POSTGRES_PASSWORD": "mypass",
        "POSTGRES_HOST": "dbhost",
        "POSTGRES_PORT": "5433",
        "POSTGRES_DB": "mydb",
    }
    with patch.dict(os.environ, overrides, clear=True):
        settings = CommonSettings()
    url = settings.database_url
    assert "myuser:mypass" in url
    assert "dbhost:5433/mydb" in url
