package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/pkg/config"
)

func testConfig() config.Config {
	return config.Config{
		JWTSecret:     "test-secret-key-for-testing",
		AdminUsername: "admin",
		AdminPassword: "testpass",
		AdminEmail:    "admin@test.local",
	}
}

func TestLogin(t *testing.T) {
	cfg := testConfig()
	handler := handlers.Login(cfg)

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			name:       "valid credentials",
			body:       map[string]string{"username": "admin", "password": "testpass"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid password",
			body:       map[string]string{"username": "admin", "password": "wrong"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid username",
			body:       map[string]string{"username": "nobody", "password": "testpass"},
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
				if resp["token_type"] != "Bearer" {
					t.Error("token_type should be Bearer")
				}
				if _, ok := resp["user"]; !ok {
					t.Error("response missing user")
				}
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	cfg := testConfig()
	handler := handlers.RefreshToken(cfg)

	// Generate a valid token for testing
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      "admin",
		"username": "admin",
		"email":    "admin@test.local",
		"role":     "admin",
		"exp":      float64(9999999999),
		"iat":      float64(1000000000),
	})
	tokenStr, _ := token.SignedString([]byte(cfg.JWTSecret))

	tests := []struct {
		name       string
		authHeader string
		wantStatus int
	}{
		{
			name:       "valid token",
			authHeader: "Bearer " + tokenStr,
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing header",
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid token",
			authHeader: "Bearer invalid.token.here",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d", rr.Code, tc.wantStatus)
			}
		})
	}
}
