package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

func TestCORS(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	handler := middleware.CORS([]string{"*"})(inner)

	tests := []struct {
		name           string
		method         string
		origin         string
		wantStatus     int
		wantAllowAll   bool
		wantBodyEmpty  bool
	}{
		{
			name:         "regular GET with origin",
			method:       http.MethodGet,
			origin:       "http://localhost:3000",
			wantStatus:   http.StatusOK,
			wantAllowAll: true,
		},
		{
			name:          "OPTIONS preflight",
			method:        http.MethodOptions,
			origin:        "http://localhost:3000",
			wantStatus:    http.StatusNoContent,
			wantAllowAll:  true,
			wantBodyEmpty: true,
		},
		{
			name:         "GET without origin header",
			method:       http.MethodGet,
			origin:       "",
			wantStatus:   http.StatusOK,
			wantAllowAll: true,
		},
		{
			name:         "POST with external origin",
			method:       http.MethodPost,
			origin:       "https://external-site.com",
			wantStatus:   http.StatusOK,
			wantAllowAll: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(tc.method, "/api/v1/test", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("status: got %d, want %d", rr.Code, tc.wantStatus)
			}

			if tc.wantAllowAll {
				if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "*" {
					t.Errorf("Access-Control-Allow-Origin: got %q, want *", got)
				}
			}

			if tc.wantBodyEmpty {
				if rr.Body.Len() != 0 {
					t.Errorf("expected empty body for preflight, got %q", rr.Body.String())
				}
			}
		})
	}
}

func TestCORS_PreflightHeaders(t *testing.T) {
	t.Parallel()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("inner handler should not be called on OPTIONS preflight")
	})

	handler := middleware.CORS([]string{"*"})(inner)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Authorization, Content-Type")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("status: got %d, want 204", rr.Code)
	}

	expectedHeaders := map[string]string{
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
		"Access-Control-Expose-Headers": "X-Request-ID",
	}

	for header, want := range expectedHeaders {
		if got := rr.Header().Get(header); got != want {
			t.Errorf("%s: got %q, want %q", header, got, want)
		}
	}
}

func TestCORS_WildcardAllowsAnyOrigin(t *testing.T) {
	t.Parallel()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.CORS([]string{"*"})(inner)

	origins := []string{
		"http://localhost:3000",
		"https://orion.example.com",
		"http://192.168.1.100:8080",
		"https://evil-site.com",
	}

	for _, origin := range origins {
		t.Run(origin, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			req.Header.Set("Origin", origin)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "*" {
				t.Errorf("origin %s: Access-Control-Allow-Origin got %q, want *", origin, got)
			}
		})
	}
}

func TestCORS_NonPreflightPassesThrough(t *testing.T) {
	t.Parallel()

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusCreated)
	})

	handler := middleware.CORS([]string{"*"})(inner)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if !called {
		t.Error("expected inner handler to be called for non-OPTIONS request")
	}
	if rr.Code != http.StatusCreated {
		t.Errorf("status: got %d, want 201", rr.Code)
	}
}
