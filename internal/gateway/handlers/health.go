package handlers

import (
	"encoding/json"
	"net/http"
)

// HealthResponse represents the JSON payload returned by health endpoints.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

// Health returns a handler that reports the service is running.
func Health() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HealthResponse{
			Status:  "ok",
			Service: "gateway",
			Version: "0.1.0",
		})
	}
}

// Ready returns a handler for readiness checks.
// It currently always reports ready; downstream connectivity checks
// (e.g., Redis, PostgreSQL) can be added here later.
func Ready() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(HealthResponse{
			Status:  "ready",
			Service: "gateway",
			Version: "0.1.0",
		})
	}
}
