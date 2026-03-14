package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/redis/go-redis/v9"
)

// HealthResponse represents the JSON payload returned by health endpoints.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

// Health returns a handler that reports the service is running.
func Health(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:  "ok",
			Service: "gateway",
			Version: version,
		})
	}
}

// Ready returns a handler for readiness checks.
// It checks Redis connectivity and returns 503 if Redis is unreachable.
func Ready(version string, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if rdb != nil {
			if err := rdb.Ping(r.Context()).Err(); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				_ = json.NewEncoder(w).Encode(HealthResponse{
					Status:  "not_ready",
					Service: "gateway",
					Version: version,
				})
				return
			}
		}

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:  "ready",
			Service: "gateway",
			Version: version,
		})
	}
}
