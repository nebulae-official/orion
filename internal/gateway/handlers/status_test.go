package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/pkg/config"
)

func TestStatus(t *testing.T) {
	t.Run("all services healthy returns ok", func(t *testing.T) {
		// Mock healthy backend.
		healthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		}))
		defer healthy.Close()

		serviceURLs := map[string]string{
			"scout":    healthy.URL,
			"director": healthy.URL,
		}
		cfg := config.Config{
			RedisURL:   "redis://localhost:6379",
			MilvusHost: "localhost",
			MilvusPort: "19530",
		}

		handler := handlers.Status(serviceURLs, cfg)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		var resp handlers.StatusResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Status != "ok" {
			t.Errorf("expected overall status %q, got %q", "ok", resp.Status)
		}
		if len(resp.Services) != 2 {
			t.Errorf("expected 2 services, got %d", len(resp.Services))
		}
	})

	t.Run("unhealthy service returns degraded", func(t *testing.T) {
		healthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer healthy.Close()

		unhealthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer unhealthy.Close()

		serviceURLs := map[string]string{
			"scout":    healthy.URL,
			"director": unhealthy.URL,
		}
		cfg := config.Config{
			RedisURL:   "redis://localhost:6379",
			MilvusHost: "localhost",
			MilvusPort: "19530",
		}

		handler := handlers.Status(serviceURLs, cfg)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var resp handlers.StatusResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Status != "degraded" {
			t.Errorf("expected overall status %q, got %q", "degraded", resp.Status)
		}
	})

	t.Run("unreachable service returns degraded", func(t *testing.T) {
		serviceURLs := map[string]string{
			"scout": "http://127.0.0.1:1",
		}
		cfg := config.Config{
			RedisURL:   "redis://localhost:6379",
			MilvusHost: "localhost",
			MilvusPort: "19530",
		}

		handler := handlers.Status(serviceURLs, cfg)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var resp handlers.StatusResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.Status != "degraded" {
			t.Errorf("expected overall status %q, got %q", "degraded", resp.Status)
		}
	})

	t.Run("infrastructure map is populated", func(t *testing.T) {
		serviceURLs := map[string]string{}
		cfg := config.Config{
			RedisURL:   "redis://localhost:6379",
			MilvusHost: "localhost",
			MilvusPort: "19530",
		}

		handler := handlers.Status(serviceURLs, cfg)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		var resp handlers.StatusResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		expectedInfra := []string{"postgres", "redis", "milvus", "grafana", "prometheus", "pgadmin"}
		for _, name := range expectedInfra {
			if _, ok := resp.Infrastructure[name]; !ok {
				t.Errorf("expected infrastructure entry %q to be present", name)
			}
		}
	})
}
