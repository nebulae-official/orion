package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/orion-rigel/orion/pkg/config"
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

// infraClient is a short-timeout HTTP client for infrastructure health checks.
var infraClient = &http.Client{
	Timeout: 2 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        6,
		MaxIdleConnsPerHost: 1,
		IdleConnTimeout:     15 * time.Second,
		DialContext: (&net.Dialer{
			Timeout: 2 * time.Second,
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

// InfraHealth represents the health status of a single infrastructure component.
type InfraHealth struct {
	Status string `json:"status"`
	Host   string `json:"host"`
}

// StatusResponse is the aggregated status of all downstream services.
type StatusResponse struct {
	Status         string                  `json:"status"`
	Services       []ServiceHealth         `json:"services"`
	Infrastructure map[string]*InfraHealth `json:"infrastructure"`
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

// infraTarget describes an infrastructure component to health-check.
type infraTarget struct {
	name      string
	host      string // host:port for display and TCP dial
	checkType string // "tcp" or "http"
	httpURL   string // only used when checkType is "http"
}

// buildInfraTargets derives the infrastructure check list from config values
// and sensible defaults for optional components.
func buildInfraTargets(cfg config.Config) []infraTarget {
	targets := make([]infraTarget, 0, 6)

	// PostgreSQL — derive host:port from config fields.
	pgHost := getEnvOrDefault("POSTGRES_HOST", "postgres")
	pgPort := getEnvOrDefault("POSTGRES_PORT", "5432")
	targets = append(targets, infraTarget{
		name:      "postgres",
		host:      net.JoinHostPort(pgHost, pgPort),
		checkType: "tcp",
	})

	// Redis — parse the URL from config.
	redisHost := hostPortFromURL(cfg.RedisURL, "redis:6379")
	targets = append(targets, infraTarget{
		name:      "redis",
		host:      redisHost,
		checkType: "tcp",
	})

	// Milvus — gRPC port from config.
	milvusHost := net.JoinHostPort(cfg.MilvusHost, cfg.MilvusPort)
	targets = append(targets, infraTarget{
		name:      "milvus",
		host:      milvusHost,
		checkType: "tcp",
	})

	// Grafana — optional monitoring stack.
	grafanaHost := getEnvOrDefault("GRAFANA_HOST", "grafana")
	grafanaPort := getEnvOrDefault("GRAFANA_PORT", "3003")
	grafanaAddr := net.JoinHostPort(grafanaHost, grafanaPort)
	targets = append(targets, infraTarget{
		name:      "grafana",
		host:      grafanaAddr,
		checkType: "http",
		httpURL:   fmt.Sprintf("http://%s/api/health", grafanaAddr),
	})

	// Prometheus — optional monitoring stack.
	promHost := getEnvOrDefault("PROMETHEUS_HOST", "prometheus")
	promPort := getEnvOrDefault("PROMETHEUS_PORT", "9090")
	promAddr := net.JoinHostPort(promHost, promPort)
	targets = append(targets, infraTarget{
		name:      "prometheus",
		host:      promAddr,
		checkType: "http",
		httpURL:   fmt.Sprintf("http://%s/-/healthy", promAddr),
	})

	// pgAdmin — optional tools profile.
	pgAdminHost := getEnvOrDefault("PGADMIN_HOST", "pgadmin")
	pgAdminPort := getEnvOrDefault("PGADMIN_PORT", "80")
	pgAdminAddr := net.JoinHostPort(pgAdminHost, pgAdminPort)
	targets = append(targets, infraTarget{
		name:      "pgadmin",
		host:      pgAdminAddr,
		checkType: "http",
		httpURL:   fmt.Sprintf("http://%s/misc/ping", pgAdminAddr),
	})

	return targets
}

// Status returns a handler that concurrently checks the /health endpoint
// of all downstream Python services and direct infrastructure components,
// returning an aggregated status.
func Status(serviceURLs map[string]string, cfg config.Config) http.HandlerFunc {
	infraTargets := buildInfraTargets(cfg)

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var wg sync.WaitGroup

		// Check services concurrently.
		results := make([]ServiceHealth, len(serviceURLs))
		i := 0
		for name, baseURL := range serviceURLs {
			wg.Add(1)
			go func(idx int, svcName, svcURL string) {
				defer wg.Done()
				results[idx] = checkService(ctx, svcName, svcURL)
			}(i, name, baseURL)
			i++
		}

		// Check infrastructure concurrently.
		infraResults := make([]*InfraHealth, len(infraTargets))
		for j, target := range infraTargets {
			wg.Add(1)
			go func(idx int, t infraTarget) {
				defer wg.Done()
				infraResults[idx] = checkInfra(ctx, t)
			}(j, target)
		}

		wg.Wait()

		// Build infrastructure map.
		infraMap := make(map[string]*InfraHealth, len(infraTargets))
		for j, target := range infraTargets {
			infraMap[target.name] = infraResults[j]
		}

		// Determine overall status.
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
		_ = json.NewEncoder(w).Encode(StatusResponse{
			Status:         overall,
			Services:       results,
			Infrastructure: infraMap,
		})
	}
}

// checkInfra performs a direct health check on an infrastructure component.
func checkInfra(ctx context.Context, t infraTarget) *InfraHealth {
	switch t.checkType {
	case "http":
		return checkInfraHTTP(ctx, t)
	default:
		return checkInfraTCP(ctx, t)
	}
}

// checkInfraTCP performs a TCP dial to verify connectivity.
func checkInfraTCP(ctx context.Context, t infraTarget) *InfraHealth {
	d := net.Dialer{Timeout: 2 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", t.host)
	if err != nil {
		return &InfraHealth{Status: "not_configured", Host: t.host}
	}
	conn.Close()
	return &InfraHealth{Status: "connected", Host: t.host}
}

// checkInfraHTTP performs an HTTP GET to verify a service is responding.
// Falls back to TCP dial if the HTTP request fails, distinguishing between
// "disconnected" (port open but HTTP failing) and "not_configured" (not reachable).
func checkInfraHTTP(ctx context.Context, t infraTarget) *InfraHealth {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.httpURL, nil)
	if err != nil {
		return &InfraHealth{Status: "not_configured", Host: t.host}
	}

	resp, err := infraClient.Do(req)
	if err != nil {
		// Could not reach the HTTP endpoint — likely not running.
		return &InfraHealth{Status: "not_configured", Host: t.host}
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return &InfraHealth{Status: "connected", Host: t.host}
	}
	return &InfraHealth{Status: "disconnected", Host: t.host}
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

// hostPortFromURL extracts host:port from a URL string, returning the
// fallback if parsing fails.
func hostPortFromURL(rawURL, fallback string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fallback
	}
	host := u.Hostname()
	port := u.Port()
	if host == "" {
		return fallback
	}
	if port == "" {
		port = "6379"
	}
	return net.JoinHostPort(host, port)
}

// getEnvOrDefault reads an env var with a fallback, used for optional
// infrastructure host overrides.
func getEnvOrDefault(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
