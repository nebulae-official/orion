// Package events defines event channel names and payload types for the Orion event bus.
package events

// Channel name constants for the Orion event bus.
const (
	ContentCreated  = "orion.content.created"
	ContentUpdated  = "orion.content.updated"
	ContentPublished = "orion.content.published"
	TrendDetected   = "orion.trend.detected"
	TrendExpired    = "orion.trend.expired"
	MediaGenerated  = "orion.media.generated"
	MediaFailed     = "orion.media.failed"
)
