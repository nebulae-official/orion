// Package models defines shared domain models for Orion.
package models

import "time"

// Content represents a piece of content managed by Orion.
type Content struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
