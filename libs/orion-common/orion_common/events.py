"""Event channel constants for the Orion event bus.

These must stay in sync with the Go-side constants in
``pkg/events/channels.go``.
"""


class Channels:
    """Redis pub/sub channel names used across all Orion services."""

    CONTENT_CREATED: str = "orion.content.created"
    CONTENT_UPDATED: str = "orion.content.updated"
    CONTENT_PUBLISHED: str = "orion.content.published"
    CONTENT_REJECTED: str = "orion.content.rejected"
    TREND_DETECTED: str = "orion.trend.detected"
    TREND_EXPIRED: str = "orion.trend.expired"
    MEDIA_GENERATED: str = "orion.media.generated"
    MEDIA_FAILED: str = "orion.media.failed"
    PIPELINE_STAGE_CHANGED: str = "orion.pipeline.stage_changed"
    NOTIFICATION_CREATED: str = "orion.notification.created"
