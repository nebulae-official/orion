package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestHealth(t *testing.T) {
	t.Run("returns ok status with correct JSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()

		handlers.Health("0.1.0").ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		contentType := rec.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", contentType)
		}

		var resp handlers.HealthResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Status != "ok" {
			t.Errorf("expected status %q, got %q", "ok", resp.Status)
		}
		if resp.Service != "gateway" {
			t.Errorf("expected service %q, got %q", "gateway", resp.Service)
		}
		if resp.Version != "0.1.0" {
			t.Errorf("expected version %q, got %q", "0.1.0", resp.Version)
		}
	})
}

func TestReady(t *testing.T) {
	t.Run("returns ready status without redis", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ready", nil)
		rec := httptest.NewRecorder()

		handlers.Ready("0.1.0", nil).ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		var resp handlers.HealthResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Status != "ready" {
			t.Errorf("expected status %q, got %q", "ready", resp.Status)
		}
	})
}
