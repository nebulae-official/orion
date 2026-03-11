package events

// ContentCreatedPayload carries data for a ContentCreated event.
type ContentCreatedPayload struct {
	ContentID string `json:"content_id"`
	Title     string `json:"title"`
	AuthorID  string `json:"author_id"`
}

// TrendDetectedPayload carries data for a TrendDetected event.
type TrendDetectedPayload struct {
	TrendID string  `json:"trend_id"`
	Topic   string  `json:"topic"`
	Score   float64 `json:"score"`
}

// MediaGeneratedPayload carries data for a MediaGenerated event.
type MediaGeneratedPayload struct {
	MediaID   string `json:"media_id"`
	ContentID string `json:"content_id"`
	URL       string `json:"url"`
}
