package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/pkg/config"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken string   `json:"access_token"`
	TokenType   string   `json:"token_type"`
	ExpiresIn   int      `json:"expires_in"`
	User        authUser `json:"user"`
}

type authUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

const tokenExpiry = 24 * time.Hour

func generateToken(cfg config.Config) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      cfg.AdminUsername,
		"username": cfg.AdminUsername,
		"email":    cfg.AdminEmail,
		"role":     "admin",
		"iat":      now.Unix(),
		"exp":      now.Add(tokenExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// Login handles POST /api/v1/auth/login.
func Login(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"message":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if req.Username == "" || req.Password == "" {
			http.Error(w, `{"message":"username and password required"}`, http.StatusBadRequest)
			return
		}

		if req.Username != cfg.AdminUsername || req.Password != cfg.AdminPassword {
			slog.Warn("login_failed", "username", req.Username)
			http.Error(w, `{"message":"invalid credentials"}`, http.StatusUnauthorized)
			return
		}

		tokenStr, err := generateToken(cfg)
		if err != nil {
			slog.Error("token_generation_failed", "error", err)
			http.Error(w, `{"message":"internal error"}`, http.StatusInternalServerError)
			return
		}

		resp := authResponse{
			AccessToken: tokenStr,
			TokenType:   "Bearer",
			ExpiresIn:   int(tokenExpiry.Seconds()),
			User: authUser{
				ID:       "admin-001",
				Username: cfg.AdminUsername,
				Email:    cfg.AdminEmail,
				Role:     "admin",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}
}

// RefreshToken handles POST /api/v1/auth/refresh.
func RefreshToken(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		_, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil {
			http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		newTokenStr, err := generateToken(cfg)
		if err != nil {
			slog.Error("token_refresh_failed", "error", err)
			http.Error(w, `{"message":"internal error"}`, http.StatusInternalServerError)
			return
		}

		resp := authResponse{
			AccessToken: newTokenStr,
			TokenType:   "Bearer",
			ExpiresIn:   int(tokenExpiry.Seconds()),
			User: authUser{
				ID:       "admin-001",
				Username: cfg.AdminUsername,
				Email:    cfg.AdminEmail,
				Role:     "admin",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}
}
