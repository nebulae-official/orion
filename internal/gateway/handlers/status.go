package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// ServiceHealth represents the health status of a single downstream service.
type ServiceHealth struct {
	Service string `json:"service"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

// StatusResponse is the aggregated status of all downstream services.
type StatusResponse struct {
	Status   string          `json:"status"`
	Services []ServiceHealth `json:"services"`
}

// Status returns a handler that concurrently checks the /health endpoint
// of all downstream Python services and returns an aggregated status.
func Status(serviceURLs map[string]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		results := make([]ServiceHealth, len(serviceURLs))
		var wg sync.WaitGroup

		i := 0
		for name, baseURL := range serviceURLs {
			wg.Add(1)
			go func(idx int, svcName, svcURL string) {
				defer wg.Done()
				results[idx] = checkService(ctx, svcName, svcURL)
			}(i, name, baseURL)
			i++
		}

		wg.Wait()

		allOK := true
		for _, sh := range results {
			if sh.Status != "ok" {
				allOK = false
				break
			}
		}

		overall := "ok"
		if !allOK {
			overall = "degraded"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(StatusResponse{
			Status:   overall,
			Services: results,
		})
	}
}

// checkService calls GET /health on a single service and returns its status.
func checkService(ctx context.Context, name, baseURL string) ServiceHealth {
	url := fmt.Sprintf("%s/health", baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ServiceHealth{Service: name, Status: "unhealthy", Error: err.Error()}
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ServiceHealth{Service: name, Status: "unhealthy", Error: err.Error()}
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return ServiceHealth{
			Service: name,
			Status:  "unhealthy",
			Error:   fmt.Sprintf("unexpected status code: %d", resp.StatusCode),
		}
	}

	return ServiceHealth{Service: name, Status: "ok"}
}
