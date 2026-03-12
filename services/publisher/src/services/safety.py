"""Content safety pre-publish checks (rule-based stub)."""

from __future__ import annotations

import os

import structlog

from src.schemas import SafetyCheckResult

logger = structlog.get_logger(__name__)

# Loaded once from env; comma-separated list
_BLOCKLIST: list[str] = [
    w.strip().lower()
    for w in os.environ.get("ORION_CONTENT_BLOCKLIST", "").split(",")
    if w.strip()
]


async def check_content_safety(
    text: str,
    has_media: bool,
    platform_char_limit: int,
) -> SafetyCheckResult:
    """Run rule-based safety checks before publishing.

    Args:
        text: The content text to check.
        has_media: Whether media assets are attached.
        platform_char_limit: Max characters for the target platform.

    Returns:
        SafetyCheckResult with passed=True if all checks pass.
    """
    violations: list[str] = []

    # Check 1: Minimum length
    if len(text.strip()) < 10:
        violations.append("Content text is too short (minimum 10 characters)")

    # Check 2: Platform character limit
    if len(text) > platform_char_limit:
        violations.append(
            f"Content exceeds platform limit ({len(text)}/{platform_char_limit} chars)"
        )

    # Check 3: Keyword blocklist
    text_lower = text.lower()
    for word in _BLOCKLIST:
        if word in text_lower:
            violations.append(f"Content contains blocked keyword: '{word}'")

    # Check 4: Media presence warning (non-blocking for now)
    if not has_media:
        logger.warning("publish_no_media", text_length=len(text))

    passed = len(violations) == 0

    if not passed:
        logger.info("safety_check_failed", violations=violations)

    return SafetyCheckResult(passed=passed, violations=violations)
