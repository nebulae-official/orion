package router_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/router"
	"github.com/orion-rigel/orion/pkg/config"
)

const testJWTSecret = "integration-test-secret"

// testConfig returns a config.Config populated with test values and mock
// service URLs pointing at the provided backends map.
func testConfig(backends map[string]string, redisAddr string) config.Config {
	get := func(key string) string {
		if v, ok := backends[key]; ok {
			return v
		}
		return "http://localhost:0" // unreachable placeholder
	}

	return config.Config{
		AppEnv:         "development",
		GatewayPort:    "0",
		RedisURL:       fmt.Sprintf("redis://%s", redisAddr),
		JWTSecret:      testJWTSecret,
		AdminUsername:   "admin",
		AdminPassword:  "secret",
		AdminEmail:     "admin@test.local",
		IdentityURL:    get("identity"),
		ScoutURL:       get("scout"),
		DirectorURL:    get("director"),
		MediaURL:       get("media"),
		EditorURL:      get("editor"),
		PulseURL:       get("pulse"),
		PublisherURL:   get("publisher"),
		AllowedOrigins: []string{"*"},
		AppVersion:     "test-1.0.0",
	}
}

// newServiceStub creates an httptest server that returns 200 with a JSON body
// for any request, and a /health endpoint that returns service health.
func newServiceStub(t *testing.T, name string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": name,
		})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": name,
			"path":    r.URL.Path,
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// newIdentityStub creates a mock identity service for auth tests.
func newIdentityStub(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("/internal/users/authenticate", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"detail":"bad request"}`, http.StatusBadRequest)
			return
		}
		if req.Email == "admin@test.local" && req.Password == "secret" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"user_id":       "00000000-0000-0000-0000-000000000002",
				"email":         "admin@test.local",
				"role":          "admin",
				"name":          "Admin",
				"avatar_url":    "",
				"refresh_token": "rt-test-token-123",
			})
			return
		}
		http.Error(w, `{"detail":"invalid credentials"}`, http.StatusUnauthorized)
	})

	mux.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			Name     string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"detail":"bad request"}`, http.StatusBadRequest)
			return
		}
		if req.Email == "exists@test.local" {
			http.Error(w, `{"detail":"conflict"}`, http.StatusConflict)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id":    "00000000-0000-0000-0000-000000000099",
			"email": req.Email,
			"name":  req.Name,
			"role":  "editor",
		})
	})

	mux.HandleFunc("/internal/tokens/refresh", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			RefreshToken string `json:"refresh_token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"detail":"bad request"}`, http.StatusBadRequest)
			return
		}
		if req.RefreshToken == "rt-test-token-123" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"user_id":       "00000000-0000-0000-0000-000000000002",
				"email":         "admin@test.local",
				"role":          "admin",
				"name":          "Admin",
				"refresh_token": "rt-test-token-456",
			})
			return
		}
		http.Error(w, `{"detail":"invalid token"}`, http.StatusUnauthorized)
	})

	mux.HandleFunc("/internal/tokens/revoke", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"revoked"}`))
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "identity",
		})
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": "identity",
			"path":    r.URL.Path,
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// setupRouter creates a full router with miniredis and stubbed services.
func setupRouter(t *testing.T) (*httptest.Server, config.Config) {
	t.Helper()

	mr := miniredis.RunT(t)

	identityStub := newIdentityStub(t)

	stubs := make(map[string]*httptest.Server)
	backends := make(map[string]string)
	for _, svc := range []string{"scout", "director", "media", "editor", "pulse", "publisher"} {
		s := newServiceStub(t, svc)
		stubs[svc] = s
		backends[svc] = s.URL
	}
	backends["identity"] = identityStub.URL

	cfg := testConfig(backends, mr.Addr())
	hub := handlers.NewHub()
	go hub.Run()
	t.Cleanup(hub.Stop)

	r, err := router.New(cfg, hub)
	if err != nil {
		t.Fatalf("router.New: %v", err)
	}

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, cfg
}

// generateTestToken creates a valid JWT for the test secret.
func generateTestToken() string {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":   "00000000-0000-0000-0000-000000000002",
		"jti":   fmt.Sprintf("test-%d", now.UnixNano()),
		"name":  "Admin",
		"email": "admin@test.local",
		"role":  "admin",
		"iat":   now.Unix(),
		"exp":   now.Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString([]byte(testJWTSecret))
	return s
}

func TestRouter_HealthEndpoint(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("want status=ok, got %q", body["status"])
	}
	if body["version"] == "" {
		t.Error("expected non-empty version")
	}
	if body["service"] != "gateway" {
		t.Errorf("want service=gateway, got %q", body["service"])
	}
}

func TestRouter_ReadyEndpoint(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	resp, err := http.Get(srv.URL + "/ready")
	if err != nil {
		t.Fatalf("GET /ready: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if body["status"] != "ready" {
		t.Errorf("want status=ready, got %q", body["status"])
	}
}

func TestRouter_StatusEndpoint(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	token := generateTestToken()
	req, _ := http.NewRequest("GET", srv.URL+"/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /status: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("want 200, got %d", resp.StatusCode)
	}

	var body struct {
		Status   string `json:"status"`
		Services []struct {
			Service string `json:"service"`
			Status  string `json:"status"`
		} `json:"services"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if body.Status != "ok" {
		t.Errorf("want aggregated status=ok, got %q", body.Status)
	}

	if len(body.Services) == 0 {
		t.Error("expected at least one service in status response")
	}

	// Verify all services report ok
	for _, svc := range body.Services {
		if svc.Status != "ok" {
			t.Errorf("service %s: want status=ok, got %q", svc.Service, svc.Status)
		}
	}
}

func TestRouter_LoginAndAuthFlow(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	// Step 1: Login with valid credentials
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "admin@test.local",
		"password": "secret",
	})
	resp, err := http.Post(srv.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatalf("POST /api/v1/auth/login: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login: want 200, got %d", resp.StatusCode)
	}

	var authResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		User         struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Name  string `json:"name"`
			Role  string `json:"role"`
		} `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}

	if authResp.AccessToken == "" {
		t.Fatal("expected non-empty access_token")
	}
	if authResp.RefreshToken == "" {
		t.Fatal("expected non-empty refresh_token")
	}
	if authResp.TokenType != "Bearer" {
		t.Errorf("want token_type=Bearer, got %q", authResp.TokenType)
	}
	if authResp.User.Email != "admin@test.local" {
		t.Errorf("want email=admin@test.local, got %q", authResp.User.Email)
	}
	if authResp.User.Name != "Admin" {
		t.Errorf("want name=Admin, got %q", authResp.User.Name)
	}
	if authResp.ExpiresIn != 900 {
		t.Errorf("want expires_in=900, got %d", authResp.ExpiresIn)
	}

	// Step 2: Use the token to access a protected proxy endpoint
	req, _ := http.NewRequest("GET", srv.URL+"/api/v1/scout/trends", nil)
	req.Header.Set("Authorization", "Bearer "+authResp.AccessToken)
	protectedResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /api/v1/scout/trends: %v", err)
	}
	defer protectedResp.Body.Close()

	if protectedResp.StatusCode != http.StatusOK {
		t.Errorf("protected endpoint: want 200, got %d", protectedResp.StatusCode)
	}

	// Step 3: Login with invalid credentials should fail
	badLogin, _ := json.Marshal(map[string]string{
		"email":    "admin@test.local",
		"password": "wrong",
	})
	badResp, err := http.Post(srv.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(badLogin))
	if err != nil {
		t.Fatalf("POST /api/v1/auth/login (bad): %v", err)
	}
	defer badResp.Body.Close()

	if badResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("bad login: want 401, got %d", badResp.StatusCode)
	}
}

func TestRouter_RateLimiting(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	token := generateTestToken()

	// Scout has a rate limit of 10 per minute.
	// Hit it rapidly and ensure we eventually get 429.
	var lastStatus int
	for i := 0; i < 12; i++ {
		req, _ := http.NewRequest("GET", srv.URL+"/api/v1/scout/trends", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("request %d: %v", i+1, err)
		}
		resp.Body.Close()
		lastStatus = resp.StatusCode

		if resp.StatusCode == http.StatusTooManyRequests {
			// Verify rate limit headers
			if resp.Header.Get("X-RateLimit-Limit") == "" {
				t.Error("expected X-RateLimit-Limit header on 429")
			}
			if resp.Header.Get("Retry-After") == "" {
				t.Error("expected Retry-After header on 429")
			}
			return // Test passed
		}
	}

	t.Errorf("expected 429 after 12 requests to scout, last status was %d", lastStatus)
}

func TestRouter_UnauthenticatedProxyAccess(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	endpoints := []string{
		"/api/v1/scout/trends",
		"/api/v1/director/content",
		"/api/v1/media/assets",
	}

	for _, ep := range endpoints {
		t.Run(ep, func(t *testing.T) {
			resp, err := http.Get(srv.URL + ep)
			if err != nil {
				t.Fatalf("GET %s: %v", ep, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("want 401, got %d", resp.StatusCode)
			}
		})
	}
}

func TestRouter_CORSPreflight(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/v1/scout/trends", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "Authorization")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("OPTIONS: %v", err)
	}
	defer resp.Body.Close()

	// The CORS middleware returns 204 for OPTIONS
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("want 204, got %d", resp.StatusCode)
	}

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("want Access-Control-Allow-Origin=*, got %q", got)
	}
	if got := resp.Header.Get("Access-Control-Allow-Methods"); got == "" {
		t.Error("expected Access-Control-Allow-Methods header")
	}
	if got := resp.Header.Get("Access-Control-Allow-Headers"); got == "" {
		t.Error("expected Access-Control-Allow-Headers header")
	}
}

func TestRouter_SecurityHeaders(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	// Test that X-Request-ID is returned on every response
	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("X-Request-ID") == "" {
		t.Error("expected X-Request-ID header")
	}

	// Verify CORS headers on normal (non-preflight) requests
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("want Access-Control-Allow-Origin=*, got %q", got)
	}
	if got := resp.Header.Get("Access-Control-Expose-Headers"); got == "" {
		t.Error("expected Access-Control-Expose-Headers header")
	}
}

func TestRouter_WebSocketTicketFlow(t *testing.T) {
	t.Parallel()
	srv, _ := setupRouter(t)

	// Step 1: Login to get a token
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "admin@test.local",
		"password": "secret",
	})
	resp, err := http.Post(srv.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()

	var authResp struct {
		AccessToken string `json:"access_token"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&authResp)

	// Step 2: Attempt WS without token — should get 401
	wsResp, err := http.Get(srv.URL + "/ws")
	if err != nil {
		t.Fatalf("GET /ws (no token): %v", err)
	}
	defer wsResp.Body.Close()

	if wsResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("ws without token: want 401, got %d", wsResp.StatusCode)
	}

	// Step 3: Attempt WS with invalid token
	badResp, err := http.Get(srv.URL + "/ws?token=invalid-token")
	if err != nil {
		t.Fatalf("GET /ws (bad token): %v", err)
	}
	defer badResp.Body.Close()

	if badResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("ws with bad token: want 401, got %d", badResp.StatusCode)
	}

	// Step 4: Attempt WS with valid token — the upgrade itself will fail
	// (because we're not using a real WebSocket client) but the handler should
	// not return 401, indicating the token validation passed.
	goodResp, err := http.Get(srv.URL + "/ws?token=" + authResp.AccessToken)
	if err != nil {
		t.Fatalf("GET /ws (valid token): %v", err)
	}
	defer goodResp.Body.Close()

	// Without proper WS upgrade headers the server returns 400 (Bad Request),
	// NOT 401 — proving that auth passed.
	if goodResp.StatusCode == http.StatusUnauthorized {
		t.Error("ws with valid token should not return 401")
	}
}
