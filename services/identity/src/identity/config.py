"""Identity service configuration."""

from pydantic import Field
from pydantic_settings import BaseSettings


class IdentitySettings(BaseSettings):
    """Settings specific to the Identity service.

    General database and Redis settings are loaded via
    ``orion_common.config.get_settings()``.  This class captures
    identity-specific knobs such as SMTP configuration.
    """

    # SMTP (optional — logs in dev mode when not configured)
    smtp_host: str = Field(default="", description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: str = Field(default="", description="SMTP username")
    smtp_pass: str = Field(default="", description="SMTP password")
    smtp_from: str = Field(
        default="noreply@orion.local",
        description="Default sender email address",
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "populate_by_name": True,
    }


def get_identity_settings() -> IdentitySettings:
    """Return identity-specific settings."""
    return IdentitySettings()
