package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/pkg/auth"
	"github.com/orion-rigel/orion/pkg/config"
)

// tokenExpiry is the lifetime of an access token (15 minutes).
const tokenExpiry = 15 * time.Minute

// ticketTTL is the lifetime of a WebSocket ticket.
const ticketTTL = 30 * time.Second

// loginRequest represents the JSON body for POST /api/v1/auth/login.
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// registerRequest represents the JSON body for POST /api/v1/auth/register.
type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// refreshRequest represents the JSON body for POST /api/v1/auth/refresh.
type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// logoutRequest represents the JSON body for POST /api/v1/auth/logout.
type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// authResponse is the login/refresh response envelope.
type authResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token,omitempty"`
	TokenType    string   `json:"token_type"`
	ExpiresIn    int      `json:"expires_in"`
	User         authUser `json:"user,omitempty"`
}

// authUser describes the authenticated user in responses.
type authUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

// registerResponse is the registration response envelope.
type registerResponse struct {
	Message string `json:"message"`
	UserID  string `json:"user_id"`
}

// identityAuthResponse is what the identity service returns on successful authentication.
type identityAuthResponse struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	Name         string `json:"name"`
	AvatarURL    string `json:"avatar_url"`
	RefreshToken string `json:"refresh_token"`
}

// identityCreateUserResponse is what the identity service returns on user creation.
type identityCreateUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

// identityRefreshResponse is what the identity service returns on token refresh.
type identityRefreshResponse struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	Name         string `json:"name"`
	RefreshToken string `json:"refresh_token"`
}

// HTTPClient is an interface for making HTTP requests (enables testing).
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// AuthHandler holds state for authentication endpoints.
type AuthHandler struct {
	cfg         config.Config
	rdb         *redis.Client
	identityURL string
	httpClient  HTTPClient
}

// NewAuthHandler creates an AuthHandler that delegates to the identity service.
func NewAuthHandler(cfg config.Config, rdb *redis.Client) (*AuthHandler, error) {
	return &AuthHandler{
		cfg:         cfg,
		rdb:         rdb,
		identityURL: cfg.IdentityURL,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}, nil
}

// NewAuthHandlerWithClient creates an AuthHandler with a custom HTTP client (for testing).
func NewAuthHandlerWithClient(cfg config.Config, rdb *redis.Client, client HTTPClient) (*AuthHandler, error) {
	return &AuthHandler{
		cfg:         cfg,
		rdb:         rdb,
		identityURL: cfg.IdentityURL,
		httpClient:  client,
	}, nil
}

// generateToken creates a signed JWT access token with the given user claims.
// If extra is non-nil, its entries are merged into the JWT claims map before signing.
func (h *AuthHandler) generateToken(userID, email, name, role string, extra map[string]interface{}) (string, string, error) {
	jti := uuid.New().String()
	now := time.Now()
	claims := jwt.MapClaims{
		"jti":   jti,
		"sub":   userID,
		"email": email,
		"name":  name,
		"role":  role,
		"iat":   now.Unix(),
		"exp":   now.Add(tokenExpiry).Unix(),
	}

	for k, v := range extra {
		claims[k] = v
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return "", "", fmt.Errorf("signing token: %w", err)
	}
	return signed, jti, nil
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1024)

		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid request body"})
			return
		}

		if req.Email == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "email and password required"})
			return
		}

		// Authenticate via identity service.
		identityReq := map[string]string{"email": req.Email, "password": req.Password}
		body, _ := json.Marshal(identityReq)

		idReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.identityURL+"/internal/users/authenticate", bytes.NewReader(body))
		if err != nil {
			slog.Error("creating identity request", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}
		idReq.Header.Set("Content-Type", "application/json")

		idResp, err := h.httpClient.Do(idReq)
		if err != nil {
			slog.Error("identity service unreachable", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "authentication service unavailable"})
			return
		}
		defer idResp.Body.Close()

		if idResp.StatusCode != http.StatusOK {
			if idResp.StatusCode == http.StatusUnauthorized || idResp.StatusCode == http.StatusNotFound {
				slog.Warn("login_failed", "email", req.Email)
				writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "invalid credentials"})
				return
			}
			slog.Error("identity service error", "status", idResp.StatusCode)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "authentication service error"})
			return
		}

		var idUser identityAuthResponse
		if err := json.NewDecoder(idResp.Body).Decode(&idUser); err != nil {
			slog.Error("decoding identity response", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		tokenStr, _, err := h.generateToken(idUser.UserID, idUser.Email, idUser.Name, idUser.Role, nil)
		if err != nil {
			slog.Error("token_generation_failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		resp := authResponse{
			AccessToken:  tokenStr,
			RefreshToken: idUser.RefreshToken,
			TokenType:    "Bearer",
			ExpiresIn:    int(tokenExpiry.Seconds()),
			User: authUser{
				ID:        idUser.UserID,
				Email:     idUser.Email,
				Name:      idUser.Name,
				Role:      idUser.Role,
				AvatarURL: idUser.AvatarURL,
			},
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

// Register handles POST /api/v1/auth/register.
func (h *AuthHandler) Register() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1024)

		var req registerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid request body"})
			return
		}

		if req.Email == "" || req.Password == "" || req.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "email, password, and name required"})
			return
		}

		// Create user via identity service.
		createReq := map[string]string{"email": req.Email, "password": req.Password, "name": req.Name}
		body, _ := json.Marshal(createReq)

		idReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.identityURL+"/users", bytes.NewReader(body))
		if err != nil {
			slog.Error("creating identity request", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}
		idReq.Header.Set("Content-Type", "application/json")

		idResp, err := h.httpClient.Do(idReq)
		if err != nil {
			slog.Error("identity service unreachable", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "registration service unavailable"})
			return
		}
		defer idResp.Body.Close()

		if idResp.StatusCode == http.StatusConflict {
			writeJSON(w, http.StatusConflict, map[string]string{"message": "email already registered"})
			return
		}

		if idResp.StatusCode != http.StatusCreated && idResp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(io.LimitReader(idResp.Body, 1024))
			slog.Error("identity service error", "status", idResp.StatusCode, "body", string(respBody))
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "registration service error"})
			return
		}

		var created identityCreateUserResponse
		if err := json.NewDecoder(idResp.Body).Decode(&created); err != nil {
			slog.Error("decoding identity response", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		writeJSON(w, http.StatusCreated, registerResponse{
			Message: "user created",
			UserID:  created.ID,
		})
	}
}

// RefreshToken handles POST /api/v1/auth/refresh.
func (h *AuthHandler) RefreshToken(bl *auth.TokenBlacklist) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1024)

		var req refreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid request body"})
			return
		}

		if req.RefreshToken == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "refresh_token required"})
			return
		}

		// Call identity service to validate and rotate the refresh token.
		refreshReq := map[string]string{"refresh_token": req.RefreshToken}
		body, _ := json.Marshal(refreshReq)

		idReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.identityURL+"/internal/tokens/refresh", bytes.NewReader(body))
		if err != nil {
			slog.Error("creating identity request", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}
		idReq.Header.Set("Content-Type", "application/json")

		idResp, err := h.httpClient.Do(idReq)
		if err != nil {
			slog.Error("identity service unreachable", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"message": "token service unavailable"})
			return
		}
		defer idResp.Body.Close()

		if idResp.StatusCode != http.StatusOK {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "invalid or expired refresh token"})
			return
		}

		var refreshed identityRefreshResponse
		if err := json.NewDecoder(idResp.Body).Decode(&refreshed); err != nil {
			slog.Error("decoding identity response", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		// Blacklist the old access token JTI if provided in the Authorization header.
		if bl != nil {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				oldTokenStr := strings.TrimPrefix(authHeader, "Bearer ")
				if oldToken, err := auth.ValidateToken(oldTokenStr, h.cfg.JWTSecret); err == nil {
					if claims, ok := oldToken.Claims.(jwt.MapClaims); ok {
						if jti, ok := claims["jti"].(string); ok && jti != "" {
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
					}
				}
			}
		}

		tokenStr, _, err := h.generateToken(refreshed.UserID, refreshed.Email, refreshed.Name, refreshed.Role, nil)
		if err != nil {
			slog.Error("token_generation_failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		resp := authResponse{
			AccessToken:  tokenStr,
			RefreshToken: refreshed.RefreshToken,
			TokenType:    "Bearer",
			ExpiresIn:    int(tokenExpiry.Seconds()),
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

// Logout handles POST /api/v1/auth/logout.
func (h *AuthHandler) Logout(bl *auth.TokenBlacklist) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if bl == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "logout not available"})
			return
		}

		// Blacklist the current access token.
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "missing authorization header"})
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
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "invalid token claims"})
			return
		}

		jti, ok := claims["jti"].(string)
		if !ok || jti == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "token missing jti claim"})
			return
		}

		exp, err := claims.GetExpirationTime()
		if err != nil || exp == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "token missing expiry"})
			return
		}
		remaining := time.Until(exp.Time)
		if remaining > 0 {
			if err := bl.Revoke(r.Context(), jti, remaining); err != nil {
				slog.Error("logout_revoke_failed", "error", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
				return
			}
		}

		// Revoke refresh token via identity service.
		r.Body = http.MaxBytesReader(w, r.Body, 1024)
		var req logoutRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.RefreshToken != "" {
			revokeReq := map[string]string{"refresh_token": req.RefreshToken}
			body, _ := json.Marshal(revokeReq)

			idReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.identityURL+"/internal/tokens/revoke", bytes.NewReader(body))
			if err == nil {
				idReq.Header.Set("Content-Type", "application/json")
				resp, err := h.httpClient.Do(idReq)
				if err != nil {
					slog.Error("identity service unreachable on logout", "error", err)
				} else {
					resp.Body.Close()
				}
			}
		}

		writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
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
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "missing authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		tok, err := auth.ValidateToken(tokenStr, h.cfg.JWTSecret)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "invalid or expired token"})
			return
		}

		// Extract user identity to store with the ticket.
		var ticketValue string
		if claims, ok := tok.Claims.(jwt.MapClaims); ok {
			identity := map[string]string{
				"user_id": fmt.Sprint(claims["sub"]),
				"name":    fmt.Sprint(claims["name"]),
				"role":    fmt.Sprint(claims["role"]),
			}
			b, _ := json.Marshal(identity)
			ticketValue = string(b)
		} else {
			ticketValue = `{"user_id":"unknown","role":"unknown"}`
		}

		ticket := uuid.New().String()
		ticketKey := fmt.Sprintf("ws:ticket:%s", ticket)

		if err := h.rdb.Set(r.Context(), ticketKey, ticketValue, ticketTTL).Err(); err != nil {
			slog.Error("failed to store ws ticket", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "internal error"})
			return
		}

		writeJSON(w, http.StatusOK, ticketResponse{
			Ticket:    ticket,
			ExpiresIn: int(ticketTTL.Seconds()),
		})
	}
}

// writeJSON encodes v as JSON and writes it to w with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
