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
		"jti":      uuid.New().String(),
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
		r.Body = http.MaxBytesReader(w, r.Body, 1024)

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
// It validates the old token, checks the blacklist, revokes the old token,
// and issues a new token.
func (h *AuthHandler) RefreshToken(bl *auth.TokenBlacklist) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		oldToken, err := auth.ValidateToken(tokenStr, h.cfg.JWTSecret)
		if err != nil {
			http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := oldToken.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"message":"invalid token claims"}`, http.StatusUnauthorized)
			return
		}

		jti, _ := claims["jti"].(string)

		// Check if the old token has been revoked before issuing a new one.
		if bl != nil && jti != "" {
			if bl.IsRevoked(r.Context(), jti) {
				http.Error(w, `{"message":"token has been revoked"}`, http.StatusUnauthorized)
				return
			}
		}

		// Revoke the old token so it cannot be reused.
		if bl != nil && jti != "" {
			exp, expErr := claims.GetExpirationTime()
			if expErr == nil && exp != nil {
				remaining := time.Until(exp.Time)
				if remaining > 0 {
					if err := bl.Revoke(r.Context(), jti, remaining); err != nil {
						slog.Error("refresh_revoke_old_token_failed", "error", err)
					}
				}
			}
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
		tok, err := auth.ValidateToken(tokenStr, h.cfg.JWTSecret)
		if err != nil {
			http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Extract user identity to store with the ticket.
		var ticketValue string
		if claims, ok := tok.Claims.(jwt.MapClaims); ok {
			identity := map[string]string{
				"username": fmt.Sprint(claims["username"]),
				"role":     fmt.Sprint(claims["role"]),
			}
			b, _ := json.Marshal(identity)
			ticketValue = string(b)
		} else {
			ticketValue = `{"username":"unknown","role":"unknown"}`
		}

		ticket := uuid.New().String()
		ticketKey := fmt.Sprintf("ws:ticket:%s", ticket)

		if err := h.rdb.Set(r.Context(), ticketKey, ticketValue, ticketTTL).Err(); err != nil {
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

// Logout handles POST /api/v1/auth/logout.
// It revokes the current token by adding its JTI to the blacklist.
func (h *AuthHandler) Logout(bl *auth.TokenBlacklist) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if bl == nil {
			http.Error(w, `{"message":"logout not available"}`, http.StatusServiceUnavailable)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(h.cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"message":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"message":"invalid token claims"}`, http.StatusUnauthorized)
			return
		}

		jti, ok := claims["jti"].(string)
		if !ok || jti == "" {
			http.Error(w, `{"message":"token missing jti claim"}`, http.StatusBadRequest)
			return
		}

		// Calculate remaining TTL so the blacklist entry expires with the token.
		exp, err := claims.GetExpirationTime()
		if err != nil || exp == nil {
			http.Error(w, `{"message":"token missing expiry"}`, http.StatusBadRequest)
			return
		}
		remaining := time.Until(exp.Time)
		if remaining <= 0 {
			// Token already expired — nothing to revoke.
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"message":"logged out"}`)) //nolint:errcheck
			return
		}

		if err := bl.Revoke(r.Context(), jti, remaining); err != nil {
			slog.Error("logout_revoke_failed", "error", err)
			http.Error(w, `{"message":"internal error"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"message":"logged out"}`)) //nolint:errcheck
	}
}
