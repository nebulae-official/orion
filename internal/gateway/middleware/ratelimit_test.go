package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

func setupMiniredis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return mr, rdb
}

func TestRateLimit(t *testing.T) {
	_, rdb := setupMiniredis(t)
	defer rdb.Close()

	cfg := middleware.RateLimitConfig{
		Group:  "test",
		Limit:  3,
		Window: time.Minute,
	}

	handler := middleware.RateLimit(rdb, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Run sequentially
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if i < 3 {
			if w.Code != http.StatusOK {
				t.Errorf("request %d: want %d, got %d", i+1, http.StatusOK, w.Code)
			}
		} else {
			if w.Code != http.StatusTooManyRequests {
				t.Errorf("request %d: want %d, got %d", i+1, http.StatusTooManyRequests, w.Code)
			}
			// Check response body
			var errResp map[string]interface{}
			if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
				t.Fatal(err)
			}
			errObj, ok := errResp["error"].(map[string]interface{})
			if !ok {
				t.Fatal("expected error object")
			}
			if errObj["code"] != "RATE_LIMIT_EXCEEDED" {
				t.Errorf("want RATE_LIMIT_EXCEEDED, got %s", errObj["code"])
			}
			// Check headers
			if w.Header().Get("Retry-After") == "" {
				t.Error("expected Retry-After header")
			}
			if w.Header().Get("X-RateLimit-Limit") != "3" {
				t.Errorf("want X-RateLimit-Limit=3, got %s", w.Header().Get("X-RateLimit-Limit"))
			}
		}
	}
}

func TestRateLimitDifferentGroups(t *testing.T) {
	_, rdb := setupMiniredis(t)
	defer rdb.Close()

	cfgA := middleware.RateLimitConfig{Group: "groupA", Limit: 1, Window: time.Minute}
	cfgB := middleware.RateLimitConfig{Group: "groupB", Limit: 1, Window: time.Minute}

	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	handlerA := middleware.RateLimit(rdb, cfgA)(ok)
	handlerB := middleware.RateLimit(rdb, cfgB)(ok)

	// First request to group A — allowed
	req := httptest.NewRequest("GET", "/a", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w := httptest.NewRecorder()
	handlerA.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("group A first request: want 200, got %d", w.Code)
	}

	// First request to group B — also allowed (different group)
	req = httptest.NewRequest("GET", "/b", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w = httptest.NewRecorder()
	handlerB.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("group B first request: want 200, got %d", w.Code)
	}

	// Second request to group A — blocked
	req = httptest.NewRequest("GET", "/a", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	w = httptest.NewRecorder()
	handlerA.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("group A second request: want 429, got %d", w.Code)
	}
}
