package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/pkg/config"
)

// newIdentityMock creates a mock identity service for testing auth handlers.
func newIdentityMock(t *testing.T) *httptest.Server {
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
		if req.Email == "admin@test.local" && req.Password == "testpass" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"user_id":       "00000000-0000-0000-0000-000000000002",
				"email":         "admin@test.local",
				"role":          "admin",
				"name":          "Admin User",
				"avatar_url":    "",
				"refresh_token": "rt-mock-refresh-token",
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
		if req.RefreshToken == "valid-refresh-token" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"user_id":       "00000000-0000-0000-0000-000000000002",
				"email":         "admin@test.local",
				"role":          "admin",
				"name":          "Admin User",
				"refresh_token": "rt-new-refresh-token",
			})
			return
		}
		http.Error(w, `{"detail":"invalid token"}`, http.StatusUnauthorized)
	})

	mux.HandleFunc("/internal/tokens/revoke", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"revoked"}`))
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func testConfig(identityURL string) config.Config {
	return config.Config{
		JWTSecret:     "test-secret-key-for-testing",
		AdminUsername:  "admin",
		AdminPassword: "testpass",
		AdminEmail:    "admin@test.local",
		AppEnv:        "development",
		IdentityURL:   identityURL,
	}
}

func TestLogin(t *testing.T) {
	idMock := newIdentityMock(t)
	cfg := testConfig(idMock.URL)

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	handler := authHandler.Login()

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "valid credentials",
			body:       map[string]string{"email": "admin@test.local", "password": "testpass"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid password",
			body:       map[string]string{"email": "admin@test.local", "password": "wrong"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid email",
			body:       map[string]string{"email": "nobody@test.local", "password": "testpass"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing fields",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d", rr.Code, tc.wantStatus)
			}

			if tc.wantStatus == http.StatusOK {
				var resp map[string]interface{}
				if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if _, ok := resp["access_token"]; !ok {
					t.Error("response missing access_token")
				}
				if _, ok := resp["refresh_token"]; !ok {
					t.Error("response missing refresh_token")
				}
				if resp["token_type"] != "Bearer" {
					t.Error("token_type should be Bearer")
				}
				if _, ok := resp["user"]; !ok {
					t.Error("response missing user")
				}
				expiresIn, ok := resp["expires_in"].(float64)
				if !ok || int(expiresIn) != 900 {
					t.Errorf("expected expires_in=900, got %v", resp["expires_in"])
				}
			}
		})
	}
}

func TestRegister(t *testing.T) {
	idMock := newIdentityMock(t)
	cfg := testConfig(idMock.URL)

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	handler := authHandler.Register()

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "valid registration",
			body:       map[string]string{"email": "new@test.local", "password": "secret123", "name": "New User"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "duplicate email",
			body:       map[string]string{"email": "exists@test.local", "password": "secret123", "name": "Duplicate"},
			wantStatus: http.StatusConflict,
		},
		{
			name:       "missing name",
			body:       map[string]string{"email": "test@test.local", "password": "secret123"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing password",
			body:       map[string]string{"email": "test@test.local", "name": "Test"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "empty body",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d, body: %s", rr.Code, tc.wantStatus, rr.Body.String())
			}

			if tc.wantStatus == http.StatusCreated {
				var resp map[string]string
				if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp["user_id"] == "" {
					t.Error("response missing user_id")
				}
				if resp["message"] != "user created" {
					t.Errorf("expected message='user created', got %q", resp["message"])
				}
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	idMock := newIdentityMock(t)
	cfg := testConfig(idMock.URL)

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	handler := authHandler.RefreshToken(nil)

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "valid refresh token",
			body:       map[string]string{"refresh_token": "valid-refresh-token"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid refresh token",
			body:       map[string]string{"refresh_token": "invalid-token"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing refresh token",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d, body: %s", rr.Code, tc.wantStatus, rr.Body.String())
			}

			if tc.wantStatus == http.StatusOK {
				var resp map[string]interface{}
				if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp["access_token"] == "" {
					t.Error("response missing access_token")
				}
				if resp["refresh_token"] == "" {
					t.Error("response missing refresh_token")
				}
			}
		})
	}
}

func TestLogout(t *testing.T) {
	idMock := newIdentityMock(t)
	cfg := testConfig(idMock.URL)

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	t.Run("no blacklist returns 503", func(t *testing.T) {
		handler := authHandler.Logout(nil)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("got status %d, want %d", rr.Code, http.StatusServiceUnavailable)
		}
	})

	t.Run("missing auth header returns 401", func(t *testing.T) {
		// Use a fake blacklist. We need a real Redis for proper blacklist,
		// but for this test we just need a non-nil value. Skip if we can't create one.
		t.Skip("blacklist requires Redis — covered by router integration test")
	})
}

func TestLoginTokenExpiry(t *testing.T) {
	idMock := newIdentityMock(t)
	cfg := testConfig(idMock.URL)

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	handler := authHandler.Login()

	body, _ := json.Marshal(map[string]string{"email": "admin@test.local", "password": "testpass"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("login failed: %d", rr.Code)
	}

	var resp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse: %v", err)
	}

	// Verify 15-minute expiry (900 seconds)
	if resp.ExpiresIn != 900 {
		t.Errorf("want expires_in=900, got %d", resp.ExpiresIn)
	}

	// Parse the JWT and verify exp claim
	token, err := jwt.Parse(resp.AccessToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		t.Fatalf("parsing token: %v", err)
	}
	claims, _ := token.Claims.(jwt.MapClaims)

	// Verify sub is the user UUID (not username)
	sub, _ := claims["sub"].(string)
	if sub != "00000000-0000-0000-0000-000000000002" {
		t.Errorf("want sub=00000000-0000-0000-0000-000000000002, got %q", sub)
	}

	// Verify name claim
	name, _ := claims["name"].(string)
	if name != "Admin User" {
		t.Errorf("want name='Admin User', got %q", name)
	}

	// Verify expiry is ~15 minutes from now
	expFloat, _ := claims["exp"].(float64)
	expTime := time.Unix(int64(expFloat), 0)
	diff := time.Until(expTime)
	if diff < 14*time.Minute || diff > 16*time.Minute {
		t.Errorf("token expiry should be ~15min, got %v", diff)
	}
}

func TestLoginIdentityServiceDown(t *testing.T) {
	// Use a URL that won't connect
	cfg := testConfig("http://localhost:1")

	authHandler, err := handlers.NewAuthHandler(cfg, nil)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	handler := authHandler.Login()

	body, _ := json.Marshal(map[string]string{"email": "admin@test.local", "password": "testpass"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Errorf("got status %d, want %d (502 when identity service is down)", rr.Code, http.StatusBadGateway)
	}
}
