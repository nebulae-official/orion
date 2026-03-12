package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

func TestMetrics(t *testing.T) {
	handler := middleware.Metrics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}
