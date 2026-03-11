// Package client provides an HTTP client for communicating with the Orion gateway.
package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Version is the CLI version, set at build time via ldflags.
var Version = "0.1.0"

// HealthResponse represents the health status returned by the gateway.
type HealthResponse struct {
	Status  string            `json:"status"`
	Service string            `json:"service,omitempty"`
	Uptime  string            `json:"uptime,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}

// StatusResponse represents the system overview returned by the gateway.
type StatusResponse struct {
	Gateway  HealthResponse            `json:"gateway"`
	Services map[string]HealthResponse `json:"services,omitempty"`
}

// OrionClient communicates with the Orion gateway over HTTP.
type OrionClient struct {
	baseURL    string
	httpClient *http.Client
}

// New creates a new OrionClient pointing at the given gateway URL.
func New(baseURL string) *OrionClient {
	return &OrionClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Health calls GET /health on the gateway and returns the response.
func (c *OrionClient) Health(ctx context.Context) (HealthResponse, error) {
	var resp HealthResponse
	if err := c.get(ctx, "/health", &resp); err != nil {
		return resp, fmt.Errorf("health check: %w", err)
	}
	return resp, nil
}

// ServiceHealth calls GET /health/{service} on the gateway.
func (c *OrionClient) ServiceHealth(ctx context.Context, service string) (HealthResponse, error) {
	var resp HealthResponse
	if err := c.get(ctx, "/health/"+service, &resp); err != nil {
		return resp, fmt.Errorf("service health check (%s): %w", service, err)
	}
	return resp, nil
}

// Status calls GET /status on the gateway and returns a system overview.
func (c *OrionClient) Status(ctx context.Context) (StatusResponse, error) {
	var resp StatusResponse
	if err := c.get(ctx, "/status", &resp); err != nil {
		return resp, fmt.Errorf("status: %w", err)
	}
	return resp, nil
}

func (c *OrionClient) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("User-Agent", "orion-cli/"+Version)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("decoding response: %w", err)
	}
	return nil
}
