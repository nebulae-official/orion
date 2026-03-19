"""Email service stubs.

In development mode these functions log the email content via structlog
instead of sending real emails.  A production implementation would use
SMTP or a transactional email API (SendGrid, SES, etc.).
"""

from __future__ import annotations

import structlog

logger = structlog.get_logger()


async def send_verification_email(email: str, token: str) -> None:
    """Send (or log) an email verification link."""
    logger.info(
        "email_verification_sent",
        to=email,
        token_preview=token[:8] + "...",
    )


async def send_reset_email(email: str, token: str) -> None:
    """Send (or log) a password reset link."""
    logger.info(
        "email_reset_sent",
        to=email,
        token_preview=token[:8] + "...",
    )


async def send_invite_email(email: str, invite_url: str) -> None:
    """Send (or log) a user invitation email."""
    logger.info(
        "email_invite_sent",
        to=email,
        invite_url=invite_url,
    )
