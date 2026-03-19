package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"time"
)

// statusClient is a dedicated HTTP client for health-checking downstream
// services. It uses explicit timeouts and connection pool settings instead
// of relying on http.DefaultClient.
var statusClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 2,
		IdleConnTimeout:     30 * time.Second,
		DialContext: (&net.Dialer{
			Timeout: 3 * time.Second,
		}).DialContext,
	},
}

// DependencyChecks holds the status of per-service dependencies.
type DependencyChecks struct {
	Redis    bool `json:"redis"`
	Postgres bool `json:"postgres"`
}

// ServiceHealth represents the health status of a single downstream service.
type ServiceHealth struct {
	Service   string            `json:"service"`
	Status    string            `json:"status"`
	Error     string            `json:"error,omitempty"`
	Uptime    string            `json:"uptime"`
	QueueSize int               `json:"queue_size"`
	Checks    *DependencyChecks `json:"checks,omitempty"`
}

// StatusResponse is the aggregated status of all downstream services.
type StatusResponse struct {
	Status   string          `json:"status"`
	Services []ServiceHealth `json:"services"`
}

// readyResponse is the expected JSON shape from a service's /ready endpoint.
type readyResponse struct {
	Status    string `json:"status"`
	Uptime    string `json:"uptime"`
	QueueSize int    `json:"queue_size"`
	Checks    struct {
		Redis    bool `json:"redis"`
		Postgres bool `json:"postgres"`
	} `json:"checks"`
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

// checkService calls GET /health and GET /ready on a single service and
// returns its status enriched with uptime, queue size, and dependency checks.
func checkService(ctx context.Context, name, baseURL string) ServiceHealth {
	healthURL := fmt.Sprintf("%s/health", baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
	if err != nil {
		return ServiceHealth{Service: name, Status: "unhealthy", Error: err.Error()}
	}

	resp, err := statusClient.Do(req)
	if err != nil {
		return ServiceHealth{Service: name, Status: "unhealthy", Error: err.Error()}
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return ServiceHealth{
			Service: name,
			Status:  "unhealthy",
			Error:   fmt.Sprintf("unexpected status code: %d", resp.StatusCode),
		}
	}

	// Also try /ready for enriched data
	result := ServiceHealth{Service: name, Status: "ok"}
	enrichFromReady(ctx, baseURL, &result)

	return result
}

// enrichFromReady calls /ready on the service and populates uptime, queue
// size, and dependency checks if available.
func enrichFromReady(ctx context.Context, baseURL string, sh *ServiceHealth) {
	readyURL := fmt.Sprintf("%s/ready", baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, readyURL, nil)
	if err != nil {
		return
	}

	resp, err := statusClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	var ready readyResponse
	if err := json.Unmarshal(body, &ready); err != nil {
		return
	}

	sh.Uptime = ready.Uptime
	sh.QueueSize = ready.QueueSize
	sh.Checks = &DependencyChecks{
		Redis:    ready.Checks.Redis,
		Postgres: ready.Checks.Postgres,
	}
}
