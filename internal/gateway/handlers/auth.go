package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/orion-rigel/orion/pkg/auth"
	"github.com/orion-rigel/orion/pkg/config"
	"golang.org/x/crypto/bcrypt"
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

const tokenExpiry = 2 * time.Hour

// ticketTTL is the lifetime of a WebSocket ticket.
const ticketTTL = 30 * time.Second

// AuthHandler holds pre-computed state for authentication endpoints.
type AuthHandler struct {
	cfg              config.Config
	adminPasswordHash []byte
	rdb              *redis.Client
}

// NewAuthHandler creates an AuthHandler, hashing the admin password at startup.
func NewAuthHandler(cfg config.Config, rdb *redis.Client) (*AuthHandler, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing admin password: %w", err)
	}
	return &AuthHandler{
		cfg:              cfg,
		adminPasswordHash: hash,
		rdb:              rdb,
	}, nil
}

func (h *AuthHandler) generateToken() (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      h.cfg.AdminUsername,
		"username": h.cfg.AdminUsername,
		"email":    h.cfg.AdminEmail,
		"role":     "admin",
		"iat":      now.Unix(),
		"exp":      now.Add(tokenExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login() http.HandlerFunc {
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

		if req.Username != h.cfg.AdminUsername {
			slog.Warn("login_failed", "username", req.Username)
			http.Error(w, `{"message":"invalid credentials"}`, http.StatusUnauthorized)
			return
		}

		if err := bcrypt.CompareHashAndPassword(h.adminPasswordHash, []byte(req.Password)); err != nil {
			slog.Warn("login_failed", "username", req.Username)
			http.Error(w, `{"message":"invalid credentials"}`, http.StatusUnauthorized)
			return
		}

		tokenStr, err := h.generateToken()
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
				Username: h.cfg.AdminUsername,
				Email:    h.cfg.AdminEmail,
				Role:     "admin",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}
}

// RefreshToken handles POST /api/v1/auth/refresh.
func (h *AuthHandler) RefreshToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		_, err := auth.ValidateToken(tokenStr, h.cfg.JWTSecret)
		if err != nil {
			http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		newTokenStr, err := h.generateToken()
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
				Username: h.cfg.AdminUsername,
				Email:    h.cfg.AdminEmail,
				Role:     "admin",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}
}

// ticketResponse is returned by the ticket exchange endpoint.
type ticketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
}

// IssueWSTicket handles POST /api/v1/ws/ticket.
// It exchanges a valid JWT for a short-lived, single-use ticket stored in Redis.
func (h *AuthHandler) IssueWSTicket() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		_, err := auth.ValidateToken(tokenStr, h.cfg.JWTSecret)
		if err != nil {
			http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ticket := uuid.New().String()
		ticketKey := fmt.Sprintf("ws:ticket:%s", ticket)

		if err := h.rdb.Set(r.Context(), ticketKey, "valid", ticketTTL).Err(); err != nil {
			slog.Error("failed to store ws ticket", "error", err)
			http.Error(w, `{"message":"internal error"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ticketResponse{
			Ticket:    ticket,
			ExpiresIn: int(ticketTTL.Seconds()),
		}) //nolint:errcheck
	}
}
