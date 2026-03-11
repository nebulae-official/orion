"""Global configuration service using Pydantic Settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class CommonSettings(BaseSettings):
    """Shared configuration for all Orion services.

    Values are loaded from environment variables and .env files.
    """

    # App
    app_env: str = Field(default="development", description="Runtime environment")
    app_name: str = Field(default="orion", description="Application name")
    debug: bool = Field(default=False, description="Enable debug mode")

    # PostgreSQL
    postgres_host: str = Field(default="localhost", description="PostgreSQL host")
    postgres_port: int = Field(default=5432, description="PostgreSQL port")
    postgres_user: str = Field(default="orion", description="PostgreSQL user")
    postgres_password: str = Field(default="orion_dev", description="PostgreSQL password")
    postgres_db: str = Field(default="orion", description="PostgreSQL database name")

    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379", description="Redis connection URL"
    )

    # Milvus
    milvus_host: str = Field(default="localhost", description="Milvus host")
    milvus_port: int = Field(default=19530, description="Milvus gRPC port")

    # Ollama
    ollama_host: str = Field(
        default="http://localhost:11434", description="Ollama API base URL"
    )

    # ComfyUI
    comfyui_host: str = Field(
        default="http://localhost:8188", description="ComfyUI API base URL"
    )

    @property
    def database_url(self) -> str:
        """Async database URL for SQLAlchemy (asyncpg driver)."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync database URL for Alembic migrations."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> CommonSettings:
    """Return a cached singleton of the global settings."""
    return CommonSettings()
