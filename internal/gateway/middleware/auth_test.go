package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	mw "github.com/orion-rigel/orion/internal/gateway/middleware"
)

const testSecret = "test-jwt-secret"

func validToken() string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      "admin",
		"username": "admin",
		"email":    "admin@test.local",
		"role":     "admin",
		"exp":      float64(9999999999),
		"iat":      float64(1000000000),
	})
	s, _ := token.SignedString([]byte(testSecret))
	return s
}

func expiredToken() string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "admin",
		"exp": float64(1000000000), // long expired
		"iat": float64(999999000),
	})
	s, _ := token.SignedString([]byte(testSecret))
	return s
}

func TestAuth(t *testing.T) {
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	tests := []struct {
		name       string
		authHeader string
		wantStatus int
	}{
		{"valid token", "Bearer " + validToken(), http.StatusOK},
		{"no header", "", http.StatusUnauthorized},
		{"bad prefix", "Token " + validToken(), http.StatusUnauthorized},
		{"expired token", "Bearer " + expiredToken(), http.StatusUnauthorized},
		{"invalid token", "Bearer bad.token.value", http.StatusUnauthorized},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			rr := httptest.NewRecorder()

			mw.Auth(testSecret, nil)(okHandler).ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d", rr.Code, tc.wantStatus)
			}
		})
	}
}
