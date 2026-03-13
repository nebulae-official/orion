"""Domain exception classes for the Publisher service."""

from __future__ import annotations


class PublisherError(Exception):
    """Base exception for all publisher domain errors."""


class ContentNotFoundError(PublisherError):
    """Raised when the requested content does not exist."""


class ContentNotApprovedError(PublisherError):
    """Raised when content is not in 'approved' status."""


class SafetyCheckFailedError(PublisherError):
    """Raised when a content safety check fails."""

    def __init__(self, violations: list[str]) -> None:
        self.violations = violations
        super().__init__(f"Safety check failed: {'; '.join(violations)}")
