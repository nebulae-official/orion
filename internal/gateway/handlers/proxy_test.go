package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestNewServiceProxy(t *testing.T) {
	t.Run("returns error for invalid target URL", func(t *testing.T) {
		_, err := handlers.NewServiceProxy("://bad-url", "tok")
		if err == nil {
			t.Fatal("expected error for invalid URL, got nil")
		}
	})

	t.Run("rewrites path stripping service segment", func(t *testing.T) {
		// Backend echoes the path it receives.
		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]string{"path": r.URL.Path})
		}))
		defer backend.Close()

		proxy, err := handlers.NewServiceProxy(backend.URL, "secret-token")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		tests := []struct {
			name     string
			reqPath  string
			wantPath string
		}{
			{"full path", "/api/v1/scout/trends", "/api/v1/trends"},
			{"nested path", "/api/v1/director/pipeline/run", "/api/v1/pipeline/run"},
			{"no rest segment", "/api/v1/scout", "/api/v1/"},
			{"short path", "/api/v1", "/api/v1/"},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodGet, tc.reqPath, nil)
				rec := httptest.NewRecorder()

				proxy.ServeHTTP(rec, req)

				var body map[string]string
				if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if body["path"] != tc.wantPath {
					t.Errorf("expected path %q, got %q", tc.wantPath, body["path"])
				}
			})
		}
	})

	t.Run("forwards internal token header", func(t *testing.T) {
		var gotToken string
		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotToken = r.Header.Get("X-Internal-Token")
			w.WriteHeader(http.StatusOK)
		}))
		defer backend.Close()

		proxy, err := handlers.NewServiceProxy(backend.URL, "my-internal-token")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/scout/trends", nil)
		rec := httptest.NewRecorder()
		proxy.ServeHTTP(rec, req)

		if gotToken != "my-internal-token" {
			t.Errorf("expected X-Internal-Token %q, got %q", "my-internal-token", gotToken)
		}
	})

	t.Run("returns 502 when backend is unreachable", func(t *testing.T) {
		proxy, err := handlers.NewServiceProxy("http://127.0.0.1:1", "tok")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v1/scout/trends", nil)
		rec := httptest.NewRecorder()
		proxy.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadGateway {
			t.Errorf("expected status %d, got %d", http.StatusBadGateway, rec.Code)
		}
	})
}
