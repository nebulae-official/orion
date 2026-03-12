// Package client provides an HTTP client for communicating with the Orion gateway.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
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

// SystemStatusResponse represents the full system status from the gateway.
type SystemStatusResponse struct {
	Mode         string `json:"mode"`
	GPUAvailable bool   `json:"gpu_available"`
	QueueDepth   int    `json:"queue_depth"`
	ActiveCount  int    `json:"active_content_count"`
}

// ContentItem represents a content item returned by the API.
type ContentItem struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	Status          string    `json:"status"`
	ConfidenceScore float64   `json:"confidence_score"`
	Assets          []Asset   `json:"assets,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at,omitempty"`
}

// Asset represents a media asset attached to a content item.
type Asset struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	URL  string `json:"url"`
	Name string `json:"name"`
}

// ContentListResponse wraps a list of content items from the API.
type ContentListResponse struct {
	Items []ContentItem `json:"items"`
	Total int           `json:"total"`
}

// ApproveRequest is the payload for content approval.
type ApproveRequest struct {
	ScheduleAt string `json:"schedule_at,omitempty"`
}

// RejectRequest is the payload for content rejection.
type RejectRequest struct {
	Feedback string `json:"feedback"`
	Action   string `json:"action,omitempty"`
}

// RegenerateRequest is the payload for content regeneration.
type RegenerateRequest struct {
	Feedback string `json:"feedback,omitempty"`
}

// TriggerScoutRequest is the payload for triggering a scout scan.
type TriggerScoutRequest struct {
	Sources []string `json:"sources,omitempty"`
	Regions []string `json:"regions,omitempty"`
}

// TriggerScoutResponse is the response from triggering a scout scan.
type TriggerScoutResponse struct {
	ScanID string `json:"scan_id"`
	Status string `json:"status"`
}

// TrendItem represents a single detected trend from the scout service.
type TrendItem struct {
	ID         string  `json:"id"`
	Topic      string  `json:"topic"`
	Source     string  `json:"source"`
	Score      float64 `json:"score"`
	DetectedAt string  `json:"detected_at"`
	Status     string  `json:"status"`
}

// TrendListResponse wraps a list of trends from the API.
type TrendListResponse struct {
	Items []TrendItem `json:"items"`
	Total int         `json:"total"`
}

// ScoutConfigResponse represents the scout service configuration.
type ScoutConfigResponse struct {
	Settings map[string]string `json:"settings"`
}

// SetScoutConfigRequest is the payload for updating a scout config value.
type SetScoutConfigRequest struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ProviderEntry represents a single provider in the provider list.
type ProviderEntry struct {
	Service  string `json:"service"`
	Provider string `json:"provider"`
	Mode     string `json:"mode"`
	Model    string `json:"model"`
	Status   string `json:"status"`
}

// ProviderListResponse wraps a list of providers from the API.
type ProviderListResponse struct {
	Providers []ProviderEntry `json:"providers"`
}

// SwitchProviderRequest is the payload for switching a service provider.
type SwitchProviderRequest struct {
	Mode     string `json:"mode"`
	Provider string `json:"provider"`
}

// ProviderStatusEntry represents a provider's detailed health and cost info.
type ProviderStatusEntry struct {
	Service     string  `json:"service"`
	Provider    string  `json:"provider"`
	Mode        string  `json:"mode"`
	Model       string  `json:"model"`
	Status      string  `json:"status"`
	Latency     string  `json:"latency"`
	CostPerCall float64 `json:"cost_per_call"`
	TotalCost   float64 `json:"total_cost"`
	CallCount   int     `json:"call_count"`
}

// ProviderStatusResponse wraps detailed provider status from the API.
type ProviderStatusResponse struct {
	Providers []ProviderStatusEntry `json:"providers"`
}

// OrionClient communicates with the Orion gateway over HTTP.
type OrionClient struct {
	baseURL    string
	token      string
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

// SetToken sets the Bearer token used for authenticated requests.
func (c *OrionClient) SetToken(token string) {
	c.token = token
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

// SystemStatus calls GET /status on the gateway and returns full system info.
func (c *OrionClient) SystemStatus(ctx context.Context) (SystemStatusResponse, error) {
	var resp SystemStatusResponse
	if err := c.get(ctx, "/status", &resp); err != nil {
		return resp, fmt.Errorf("system status: %w", err)
	}
	return resp, nil
}

// SystemLogs retrieves log lines for a service.
func (c *OrionClient) SystemLogs(ctx context.Context, service string, tail int) (string, error) {
	path := fmt.Sprintf("/api/v1/logs/%s?tail=%d", service, tail)
	req, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	return string(body), nil
}

// SystemLogsStream opens a streaming connection for service logs.
func (c *OrionClient) SystemLogsStream(ctx context.Context, service string, tail int) (io.ReadCloser, error) {
	path := fmt.Sprintf("/api/v1/logs/%s?tail=%d&follow=true", service, tail)
	req, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	// Use a separate client without timeout for streaming.
	streamClient := &http.Client{}
	resp, err := streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	return resp.Body, nil
}

// ListContent retrieves content items, optionally filtered by status.
func (c *OrionClient) ListContent(ctx context.Context, status string, limit int) (ContentListResponse, error) {
	path := "/api/v1/content?limit=" + strconv.Itoa(limit)
	if status != "" {
		path += "&status=" + status
	}

	var resp ContentListResponse
	if err := c.get(ctx, path, &resp); err != nil {
		return resp, fmt.Errorf("list content: %w", err)
	}
	return resp, nil
}

// GetContent retrieves a single content item by ID.
func (c *OrionClient) GetContent(ctx context.Context, id string) (ContentItem, error) {
	var resp ContentItem
	if err := c.get(ctx, "/api/v1/content/"+id, &resp); err != nil {
		return resp, fmt.Errorf("get content: %w", err)
	}
	return resp, nil
}

// ApproveContent approves a content item, optionally scheduling publication.
func (c *OrionClient) ApproveContent(ctx context.Context, id string, scheduleAt string) error {
	payload := ApproveRequest{ScheduleAt: scheduleAt}
	if err := c.post(ctx, "/api/v1/content/"+id+"/approve", payload, nil); err != nil {
		return fmt.Errorf("approve content: %w", err)
	}
	return nil
}

// RejectContent rejects a content item with feedback and an optional action.
func (c *OrionClient) RejectContent(ctx context.Context, id string, feedback, action string) error {
	payload := RejectRequest{Feedback: feedback, Action: action}
	if err := c.post(ctx, "/api/v1/content/"+id+"/reject", payload, nil); err != nil {
		return fmt.Errorf("reject content: %w", err)
	}
	return nil
}

// RegenerateContent requests regeneration of a content item.
func (c *OrionClient) RegenerateContent(ctx context.Context, id string, feedback string) error {
	payload := RegenerateRequest{Feedback: feedback}
	if err := c.post(ctx, "/api/v1/content/"+id+"/regenerate", payload, nil); err != nil {
		return fmt.Errorf("regenerate content: %w", err)
	}
	return nil
}

// TriggerScout initiates a scout scan with optional source and region filters.
func (c *OrionClient) TriggerScout(ctx context.Context, sources, regions []string) (TriggerScoutResponse, error) {
	var resp TriggerScoutResponse
	payload := TriggerScoutRequest{Sources: sources, Regions: regions}
	if err := c.post(ctx, "/api/v1/scout/scan", payload, &resp); err != nil {
		return resp, fmt.Errorf("trigger scout: %w", err)
	}
	return resp, nil
}

// ListTrends retrieves detected trends with optional limit and minimum score.
func (c *OrionClient) ListTrends(ctx context.Context, limit int, minScore float64) (TrendListResponse, error) {
	path := fmt.Sprintf("/api/v1/trends?limit=%d", limit)
	if minScore > 0 {
		path += fmt.Sprintf("&min_score=%.2f", minScore)
	}

	var resp TrendListResponse
	if err := c.get(ctx, path, &resp); err != nil {
		return resp, fmt.Errorf("list trends: %w", err)
	}
	return resp, nil
}

// GetScoutConfig retrieves the current scout service configuration.
func (c *OrionClient) GetScoutConfig(ctx context.Context) (ScoutConfigResponse, error) {
	var resp ScoutConfigResponse
	if err := c.get(ctx, "/api/v1/scout/config", &resp); err != nil {
		return resp, fmt.Errorf("get scout config: %w", err)
	}
	return resp, nil
}

// SetScoutConfig updates a single configuration key in the scout service.
func (c *OrionClient) SetScoutConfig(ctx context.Context, key, value string) error {
	payload := SetScoutConfigRequest{Key: key, Value: value}
	if err := c.put(ctx, "/api/v1/scout/config", payload, nil); err != nil {
		return fmt.Errorf("set scout config: %w", err)
	}
	return nil
}

// ListProviders retrieves the list of configured providers across services.
func (c *OrionClient) ListProviders(ctx context.Context) (ProviderListResponse, error) {
	var resp ProviderListResponse
	if err := c.get(ctx, "/api/v1/providers", &resp); err != nil {
		return resp, fmt.Errorf("list providers: %w", err)
	}
	return resp, nil
}

// SwitchProvider switches the active provider for a given service.
func (c *OrionClient) SwitchProvider(ctx context.Context, service, mode, provider string) error {
	payload := SwitchProviderRequest{Mode: mode, Provider: provider}
	if err := c.put(ctx, "/api/v1/providers/"+service, payload, nil); err != nil {
		return fmt.Errorf("switch provider: %w", err)
	}
	return nil
}

// ProviderStatus retrieves detailed provider health and cost information.
func (c *OrionClient) ProviderStatus(ctx context.Context) (ProviderStatusResponse, error) {
	var resp ProviderStatusResponse
	if err := c.get(ctx, "/api/v1/providers/status", &resp); err != nil {
		return resp, fmt.Errorf("provider status: %w", err)
	}
	return resp, nil
}

// newRequest creates an HTTP request with common headers and auth.
func (c *OrionClient) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "orion-cli/"+Version)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	return req, nil
}

func (c *OrionClient) get(ctx context.Context, path string, out any) error {
	req, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

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

	if out != nil {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}

func (c *OrionClient) post(ctx context.Context, path string, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encoding request: %w", err)
		}
		body = bytes.NewReader(data)
	}

	req, err := c.newRequest(ctx, http.MethodPost, path, body)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(respBody))
	}

	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}

func (c *OrionClient) put(ctx context.Context, path string, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encoding request: %w", err)
		}
		body = bytes.NewReader(data)
	}

	req, err := c.newRequest(ctx, http.MethodPut, path, body)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(respBody))
	}

	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}
