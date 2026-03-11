package models

import "time"

// Trend represents a detected content trend.
type Trend struct {
	ID         string    `json:"id"`
	Topic      string    `json:"topic"`
	Score      float64   `json:"score"`
	DetectedAt time.Time `json:"detected_at"`
}
