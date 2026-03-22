package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestSystemInfoHandler(t *testing.T) {
	t.Run("returns valid JSON with expected fields", func(t *testing.T) {
		handler := handlers.SystemInfoHandler()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/system", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		contentType := rec.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", contentType)
		}

		var info handlers.SystemInfo
		if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if info.OS == "" {
			t.Error("expected OS to be non-empty")
		}
		if info.Architecture == "" {
			t.Error("expected Architecture to be non-empty")
		}
		if info.NumCPU == 0 {
			t.Error("expected NumCPU > 0")
		}
		if info.GoVersion == "" {
			t.Error("expected GoVersion to be non-empty")
		}
	})

	t.Run("host=false forces linux metrics", func(t *testing.T) {
		handler := handlers.SystemInfoHandler()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/system?host=false", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var info handlers.SystemInfo
		if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		// When host=false, MetricsSource should be "linux" or "wsl", not "windows_host".
		if info.MetricsSource == "windows_host" {
			t.Error("expected MetricsSource != windows_host when host=false")
		}
	})

	t.Run("uptime is non-negative", func(t *testing.T) {
		handler := handlers.SystemInfoHandler()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/system", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var info handlers.SystemInfo
		if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if info.UptimeSeconds < 0 {
			t.Errorf("expected non-negative uptime, got %f", info.UptimeSeconds)
		}
	})

	t.Run("memory total is non-zero", func(t *testing.T) {
		handler := handlers.SystemInfoHandler()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/system?host=false", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var info handlers.SystemInfo
		if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if info.MemoryTotal == 0 {
			t.Error("expected MemoryTotal > 0")
		}
	})
}

func TestFormatUptime(t *testing.T) {
	// formatUptime is tested indirectly via the handler's Uptime field.
	handler := handlers.SystemInfoHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var info handlers.SystemInfo
	if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if info.Uptime == "" {
		t.Error("expected Uptime to be non-empty string")
	}
}
