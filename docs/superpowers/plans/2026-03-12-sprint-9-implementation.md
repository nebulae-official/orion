# Sprint 9: JWT Auth, WebSocket & Social Publishing — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close ORION-7 (Dashboard UI) with Gateway JWT auth + WebSocket hub, and start ORION-70 (Social Publishing) with Publisher service + X/Twitter integration.

**Architecture:** Go Gateway gets JWT endpoints matching dashboard's existing auth flow, plus a WebSocket hub bridging Redis pub/sub to browsers. New Python Publisher microservice handles social media posting via Strategy pattern.

**Tech Stack:** Go (golang-jwt/jwt/v5, gorilla/websocket), Python (tweepy, cryptography, FastAPI), Next.js (React 19, Tailwind)

---

## Chunk 1: Gateway JWT Authentication (ORION-89)

### Task 1: Config — Add JWT and Admin Fields

**Files:**
- Modify: `pkg/config/config.go`

- [ ] **Step 1: Add auth fields to Config struct and Load function**

In `pkg/config/config.go`, add these fields after the `PulseURL` field:

```go
// Authentication
JWTSecret     string
AdminUsername string
AdminPassword string
AdminEmail    string
```

And in `Load()`, add after `PulseURL` line:

```go
JWTSecret:     getEnv("ORION_JWT_SECRET", "dev-secret-change-in-production"),
AdminUsername: getEnv("ORION_ADMIN_USER", "admin"),
AdminPassword: getEnv("ORION_ADMIN_PASS", "orion_dev"),
AdminEmail:    getEnv("ORION_ADMIN_EMAIL", "admin@orion.local"),
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./...`
Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add pkg/config/config.go
git commit -m "feat(ORION-89): add JWT and admin config fields to gateway"
```

---

### Task 2: Auth Handlers — Login and Refresh

**Files:**
- Create: `internal/gateway/handlers/auth.go`
- Create: `internal/gateway/handlers/auth_test.go`

- [ ] **Step 1: Add JWT and bcrypt dependencies**

```bash
go get github.com/golang-jwt/jwt/v5@latest
go get golang.org/x/crypto@latest
```

- [ ] **Step 2: Write auth handler tests**

Create `internal/gateway/handlers/auth_test.go`:

```go
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `go test ./internal/gateway/handlers/ -run TestLogin -v`
Expected: FAIL (handlers.Login not defined)

- [ ] **Step 4: Implement auth handlers**

Create `internal/gateway/handlers/auth.go`:

```go
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
	AccessToken string      `json:"access_token"`
	TokenType   string      `json:"token_type"`
	ExpiresIn   int         `json:"expires_in"`
	User        authUser    `json:"user"`
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
		json.NewEncoder(w).Encode(resp)
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
		json.NewEncoder(w).Encode(resp)
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `go test ./internal/gateway/handlers/ -run "TestLogin|TestRefreshToken" -v`
Expected: PASS (all cases)

- [ ] **Step 6: Commit**

```bash
git add internal/gateway/handlers/auth.go internal/gateway/handlers/auth_test.go go.mod go.sum
git commit -m "feat(ORION-89): implement JWT login and refresh handlers"
```

---

### Task 3: Auth Middleware — JWT Validation

**Files:**
- Create: `internal/gateway/middleware/auth.go`
- Create: `internal/gateway/middleware/auth_test.go`

- [ ] **Step 1: Write middleware tests**

Create `internal/gateway/middleware/auth_test.go`:

```go
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

			mw.Auth(testSecret)(okHandler).ServeHTTP(rr, req)

			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d", rr.Code, tc.wantStatus)
			}
		})
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/gateway/middleware/ -run TestAuth -v`
Expected: FAIL (Auth function not defined)

- [ ] **Step 3: Implement auth middleware**

Create `internal/gateway/middleware/auth.go`:

```go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userContextKey contextKey = "user"

// UserClaims holds the JWT claims extracted from the token.
type UserClaims struct {
	Username string
	Email    string
	Role     string
}

// GetUser retrieves the authenticated user from the request context.
func GetUser(ctx context.Context) (UserClaims, bool) {
	u, ok := ctx.Value(userContextKey).(UserClaims)
	return u, ok
}

// Auth returns middleware that validates JWT Bearer tokens.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"message":"missing or invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"message":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			user := UserClaims{
				Username: claimStr(claims, "username"),
				Email:    claimStr(claims, "email"),
				Role:     claimStr(claims, "role"),
			}

			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func claimStr(claims jwt.MapClaims, key string) string {
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/gateway/middleware/ -run TestAuth -v`
Expected: PASS (all 5 cases)

- [ ] **Step 5: Commit**

```bash
git add internal/gateway/middleware/auth.go internal/gateway/middleware/auth_test.go
git commit -m "feat(ORION-89): implement JWT validation middleware"
```

---

### Task 4: Router — Wire Auth Endpoints and Protect Routes

**Files:**
- Modify: `internal/gateway/router/router.go`

- [ ] **Step 1: Update router to add auth routes and protect service proxies**

In `router.go`, add the import for `handlers` (already imported) and update the `New` function:

After the `/status` handler and before the Redis client setup, add:

```go
// Auth endpoints (public)
r.Post("/api/v1/auth/login", handlers.Login(cfg))
r.Post("/api/v1/auth/refresh", handlers.RefreshToken(cfg))
```

Then wrap all the service proxy routes inside a group with auth middleware. Replace the `for name, url := range services` loop with:

```go
r.Group(func(protected chi.Router) {
    protected.Use(middleware.Auth(cfg.JWTSecret))

    for name, url := range services {
        // ... existing proxy and rate limit code stays the same
    }
})
```

Do the same for the `mountFlatProxy` fallback path.

- [ ] **Step 2: Verify it compiles and existing tests pass**

Run: `go build ./... && go test ./...`
Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add internal/gateway/router/router.go
git commit -m "feat(ORION-89): wire auth endpoints and protect API routes with JWT middleware"
```

---

## Chunk 2: Gateway WebSocket Hub (ORION-90)

### Task 5: WebSocket Hub — Redis-to-Browser Bridge

**Files:**
- Create: `internal/gateway/handlers/websocket.go`
- Create: `internal/gateway/handlers/websocket_test.go`

- [ ] **Step 1: Add gorilla/websocket dependency**

```bash
go get github.com/gorilla/websocket@latest
```

- [ ] **Step 2: Write WebSocket hub tests**

Create `internal/gateway/handlers/websocket_test.go`:

```go
package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestHub_BroadcastReachesClient(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server with WebSocket handler
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret")(w, r)
	}))
	defer srv.Close()

	// Generate valid token
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "admin", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	// Connect WebSocket
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	// Broadcast a message
	msg := handlers.WSMessage{
		Type:      "orion.test.event",
		Payload:   json.RawMessage(`{"key":"value"}`),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	hub.Broadcast(msg)

	// Read the message
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read message failed: %v", err)
	}

	var received handlers.WSMessage
	if err := json.Unmarshal(data, &received); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if received.Type != "orion.test.event" {
		t.Errorf("got type %q, want orion.test.event", received.Type)
	}
}

func TestWebSocket_RejectsNoToken(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret")(w, r)
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected connection to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", resp.StatusCode)
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `go test ./internal/gateway/handlers/ -run "TestHub|TestWebSocket" -v`
Expected: FAIL (NewHub not defined)

- [ ] **Step 4: Implement WebSocket hub**

Create `internal/gateway/handlers/websocket.go`:

```go
package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in dev; restrict in production
	},
}

// WSMessage is the JSON structure sent to WebSocket clients.
type WSMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp string          `json:"timestamp"`
}

// Hub manages WebSocket client connections and broadcasts messages.
type Hub struct {
	clients    map[*websocket.Conn]struct{}
	mu         sync.RWMutex
	broadcast  chan WSMessage
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	done       chan struct{}
}

// NewHub creates a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]struct{}),
		broadcast:  make(chan WSMessage, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		done:       make(chan struct{}),
	}
}

// Run starts the hub event loop. Call in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case conn := <-h.register:
			h.mu.Lock()
			h.clients[conn] = struct{}{}
			h.mu.Unlock()
			slog.Info("ws_client_connected", "total", len(h.clients))

		case conn := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
			}
			h.mu.Unlock()
			slog.Info("ws_client_disconnected", "total", len(h.clients))

		case msg := <-h.broadcast:
			data, err := json.Marshal(msg)
			if err != nil {
				slog.Error("ws_marshal_error", "error", err)
				continue
			}
			h.mu.RLock()
			for conn := range h.clients {
				if err := conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
					h.mu.RUnlock()
					h.unregister <- conn
					h.mu.RLock()
					continue
				}
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					h.mu.RUnlock()
					h.unregister <- conn
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()

		case <-h.done:
			return
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg WSMessage) {
	select {
	case h.broadcast <- msg:
	default:
		slog.Warn("ws_broadcast_buffer_full")
	}
}

// Stop shuts down the hub.
func (h *Hub) Stop() {
	close(h.done)
	h.mu.Lock()
	for conn := range h.clients {
		conn.Close()
	}
	h.mu.Unlock()
}

// HandleWebSocket returns an HTTP handler that upgrades to WebSocket.
// JWT is validated from the ?token= query parameter.
func HandleWebSocket(hub *Hub, jwtSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			http.Error(w, `{"message":"missing token"}`, http.StatusUnauthorized)
			return
		}

		_, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil {
			http.Error(w, `{"message":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws_upgrade_failed", "error", err)
			return
		}

		hub.register <- conn

		// Read pump — keeps connection alive and detects disconnect
		go func() {
			defer func() { hub.unregister <- conn }()
			conn.SetReadLimit(512)
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			conn.SetPongHandler(func(string) error {
				conn.SetReadDeadline(time.Now().Add(60 * time.Second))
				return nil
			})
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()

		// Ping pump — keeps connection alive through proxies
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
						return
					}
				case <-hub.done:
					return
				}
			}
		}()
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `go test ./internal/gateway/handlers/ -run "TestHub|TestWebSocket" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/gateway/handlers/websocket.go internal/gateway/handlers/websocket_test.go go.mod go.sum
git commit -m "feat(ORION-90): implement WebSocket hub with JWT auth and broadcast"
```

---

### Task 6: Wire WebSocket and Redis Subscription into Gateway

**Files:**
- Modify: `internal/gateway/router/router.go`
- Modify: `cmd/gateway/main.go`

- [ ] **Step 1: Add WebSocket route to router**

In `router.go`, the `New` function signature changes to accept a `*handlers.Hub`:

```go
func New(cfg config.Config, hub *handlers.Hub) (chi.Router, error) {
```

Add the WebSocket route after the auth routes:

```go
r.Get("/ws", handlers.HandleWebSocket(hub, cfg.JWTSecret))
```

- [ ] **Step 2: Update main.go to create hub and subscribe to Redis**

In `cmd/gateway/main.go`, add hub initialization before router creation:

```go
import (
    // ... existing imports
    "github.com/redis/go-redis/v9"
    "github.com/orion-rigel/orion/internal/gateway/handlers"
)

// After cfg := config.Load():
hub := handlers.NewHub()
go hub.Run()

// Redis pub/sub for WebSocket broadcast
go func() {
    opt, err := redis.ParseURL(cfg.RedisURL)
    if err != nil {
        slog.Warn("redis_pubsub_disabled", "error", err)
        return
    }
    rdb := redis.NewClient(opt)
    ctx := context.Background()
    pubsub := rdb.PSubscribe(ctx, "orion.*")
    defer pubsub.Close()

    slog.Info("ws_redis_subscription_started")
    ch := pubsub.Channel()
    for msg := range ch {
        wsMsg := handlers.WSMessage{
            Type:      msg.Channel,
            Payload:   json.RawMessage(msg.Payload),
            Timestamp: time.Now().UTC().Format(time.RFC3339),
        }
        hub.Broadcast(wsMsg)
    }
}()

r, err := router.New(cfg, hub)
```

Update the shutdown section to stop the hub:

```go
// After srv.Shutdown:
hub.Stop()
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./...`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add internal/gateway/router/router.go cmd/gateway/main.go
git commit -m "feat(ORION-90): wire WebSocket hub and Redis pub/sub into gateway"
```

---

## Chunk 3: Publisher Service Scaffold (ORION-91) + Safety Stub (ORION-95)

### Task 7: DB Models — SocialAccount and PublishRecord

**Files:**
- Modify: `libs/orion-common/orion_common/db/models.py`

- [ ] **Step 1: Add PublishStatus enum and new models**

At the end of the enums section (after `PipelineStatus`), add:

```python
class PublishStatus(str, enum.Enum):
    """Status of a publishing attempt."""

    pending = "pending"
    published = "published"
    failed = "failed"
```

At the end of the models section (after `PipelineRun`), add:

```python
class SocialAccount(Base):
    """Credentials for a connected social media platform."""

    __tablename__ = "social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    platform: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    credentials: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PublishRecord(Base):
    """Tracks a content publish attempt to a social platform."""

    __tablename__ = "publish_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contents.id"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(64), nullable=False)
    platform_post_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[PublishStatus] = mapped_column(
        Enum(PublishStatus, name="publish_status"),
        nullable=False,
        default=PublishStatus.pending,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    content: Mapped["Content"] = relationship()
```

- [ ] **Step 2: Commit**

```bash
git add libs/orion-common/orion_common/db/models.py
git commit -m "feat(ORION-91): add SocialAccount and PublishRecord DB models"
```

---

### Task 8: Publisher Service Scaffold

**Files:**
- Create: `services/publisher/pyproject.toml`
- Create: `services/publisher/Dockerfile`
- Create: `services/publisher/CLAUDE.md`
- Create: `services/publisher/src/__init__.py`
- Create: `services/publisher/src/main.py`
- Create: `services/publisher/src/schemas.py`
- Create: `services/publisher/src/routes/__init__.py`
- Create: `services/publisher/src/routes/publish.py`
- Create: `services/publisher/src/routes/accounts.py`
- Create: `services/publisher/src/providers/__init__.py`
- Create: `services/publisher/src/providers/base.py`
- Create: `services/publisher/src/services/__init__.py`
- Create: `services/publisher/src/services/safety.py`
- Create: `services/publisher/src/services/crypto.py`
- Create: `services/publisher/src/repositories/__init__.py`
- Create: `services/publisher/src/repositories/publish_repo.py`
- Create: `services/publisher/tests/__init__.py`
- Create: `services/publisher/tests/conftest.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "orion-publisher"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "pydantic>=2.10.0",
    "orion-common @ file:../../libs/orion-common",
    "tweepy>=4.14.0",
    "cryptography>=42.0.0",
]
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY . .
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8006"]
```

- [ ] **Step 3: Create CLAUDE.md**

```markdown
# Publisher Service

Social media publishing service — posts approved content to connected platforms.

## Dev

\```bash
pip install -e .
uvicorn src.main:app --reload --port 8006
\```

## Responsibilities
- Manage social media account connections
- Publish approved content to platforms (X/Twitter, YouTube, TikTok)
- Track publishing history and status
- Run content safety checks before publishing
```

- [ ] **Step 4: Create schemas.py**

```python
"""Pydantic schemas for the Publisher service."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PublishRequest(BaseModel):
    """Request to publish content to one or more platforms."""

    content_id: UUID
    platforms: list[str] = Field(min_length=1)


class PublishResult(BaseModel):
    """Result of a single platform publish attempt."""

    platform: str
    status: str  # "published" or "failed"
    platform_post_id: str | None = None
    error: str | None = None


class PublishResponse(BaseModel):
    """Response from publishing content."""

    content_id: UUID
    results: list[PublishResult]
    published_at: datetime | None = None


class PublishRecordResponse(BaseModel):
    """A publish history record."""

    id: UUID
    content_id: UUID
    platform: str
    platform_post_id: str | None
    status: str
    error_message: str | None
    published_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialAccountCreate(BaseModel):
    """Request to add a social account."""

    platform: str
    display_name: str
    credentials: dict[str, str]


class SocialAccountResponse(BaseModel):
    """A social account (credentials redacted)."""

    id: UUID
    platform: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SafetyCheckResult(BaseModel):
    """Result of a content safety check."""

    passed: bool
    violations: list[str] = Field(default_factory=list)
```

- [ ] **Step 5: Create providers/base.py — abstract SocialProvider**

```python
"""Abstract base class for social media providers."""

from __future__ import annotations

from abc import ABC, abstractmethod

from services.publisher.src.schemas import PublishResult


class PublishContent:
    """Content data needed by a social provider to publish."""

    def __init__(
        self,
        text: str,
        media_paths: list[str] | None = None,
        hashtags: list[str] | None = None,
    ) -> None:
        self.text = text
        self.media_paths = media_paths or []
        self.hashtags = hashtags or []


class SocialProvider(ABC):
    """Strategy interface for social media platform integrations."""

    @abstractmethod
    async def publish(self, content: PublishContent) -> PublishResult:
        """Publish content to the platform."""

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Check if stored credentials are valid."""

    @abstractmethod
    def get_character_limit(self) -> int:
        """Return the platform's character limit for posts."""

    @abstractmethod
    def get_platform_name(self) -> str:
        """Return the platform identifier string."""
```

- [ ] **Step 6: Create services/safety.py — content safety stub (ORION-95)**

```python
"""Content safety pre-publish checks (rule-based stub)."""

from __future__ import annotations

import os

import structlog

from services.publisher.src.schemas import SafetyCheckResult

logger = structlog.get_logger(__name__)

# Loaded once from env; comma-separated list
_BLOCKLIST: list[str] = [
    w.strip().lower()
    for w in os.environ.get("ORION_CONTENT_BLOCKLIST", "").split(",")
    if w.strip()
]


async def check_content_safety(
    text: str,
    has_media: bool,
    platform_char_limit: int,
) -> SafetyCheckResult:
    """Run rule-based safety checks before publishing.

    Args:
        text: The content text to check.
        has_media: Whether media assets are attached.
        platform_char_limit: Max characters for the target platform.

    Returns:
        SafetyCheckResult with passed=True if all checks pass.
    """
    violations: list[str] = []

    # Check 1: Minimum length
    if len(text.strip()) < 10:
        violations.append("Content text is too short (minimum 10 characters)")

    # Check 2: Platform character limit
    if len(text) > platform_char_limit:
        violations.append(
            f"Content exceeds platform limit ({len(text)}/{platform_char_limit} chars)"
        )

    # Check 3: Keyword blocklist
    text_lower = text.lower()
    for word in _BLOCKLIST:
        if word in text_lower:
            violations.append(f"Content contains blocked keyword: '{word}'")

    # Check 4: Media presence warning (non-blocking for now)
    if not has_media:
        logger.warning("publish_no_media", text_length=len(text))

    passed = len(violations) == 0

    if not passed:
        await logger.ainfo("safety_check_failed", violations=violations)

    return SafetyCheckResult(passed=passed, violations=violations)
```

- [ ] **Step 7: Create services/crypto.py — credential encryption**

```python
"""Credential encryption/decryption using Fernet symmetric encryption."""

from __future__ import annotations

import json
import os

from cryptography.fernet import Fernet


def _get_key() -> bytes:
    """Get the Fernet encryption key from env or generate a dev default."""
    key = os.environ.get("ORION_ENCRYPTION_KEY")
    if key:
        return key.encode()
    # Dev fallback — deterministic key for local development
    return Fernet.generate_key()


_fernet = Fernet(_get_key())


def encrypt_credentials(creds: dict[str, str]) -> str:
    """Encrypt a credentials dict to a string for DB storage."""
    plaintext = json.dumps(creds).encode()
    return _fernet.encrypt(plaintext).decode()


def decrypt_credentials(encrypted: str) -> dict[str, str]:
    """Decrypt a stored credentials string back to a dict."""
    plaintext = _fernet.decrypt(encrypted.encode())
    return json.loads(plaintext)
```

- [ ] **Step 8: Create repositories/publish_repo.py**

```python
"""Repository for publish records and social accounts."""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import PublishRecord, SocialAccount

logger = structlog.get_logger(__name__)


class PublishRepository:
    """Data access for publish records and social accounts."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Social Accounts ───────────────────────────────────────────

    async def create_account(self, account: SocialAccount) -> SocialAccount:
        self.session.add(account)
        await self.session.flush()
        return account

    async def list_accounts(self, active_only: bool = True) -> list[SocialAccount]:
        stmt = select(SocialAccount)
        if active_only:
            stmt = stmt.where(SocialAccount.is_active.is_(True))
        result = await self.session.execute(stmt.order_by(SocialAccount.created_at.desc()))
        return list(result.scalars().all())

    async def get_account(self, account_id: UUID) -> SocialAccount | None:
        return await self.session.get(SocialAccount, account_id)

    async def get_account_for_platform(self, platform: str) -> SocialAccount | None:
        stmt = (
            select(SocialAccount)
            .where(SocialAccount.platform == platform, SocialAccount.is_active.is_(True))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_account(self, account_id: UUID) -> bool:
        account = await self.session.get(SocialAccount, account_id)
        if account is None:
            return False
        await self.session.delete(account)
        await self.session.flush()
        return True

    # ── Publish Records ───────────────────────────────────────────

    async def create_record(self, record: PublishRecord) -> PublishRecord:
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_records(
        self,
        content_id: UUID | None = None,
        limit: int = 50,
    ) -> list[PublishRecord]:
        stmt = select(PublishRecord).order_by(PublishRecord.created_at.desc()).limit(limit)
        if content_id:
            stmt = stmt.where(PublishRecord.content_id == content_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
```

- [ ] **Step 9: Create routes/accounts.py**

```python
"""Social account management endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.models import SocialAccount
from orion_common.db.session import get_session

from services.publisher.src.repositories.publish_repo import PublishRepository
from services.publisher.src.schemas import SocialAccountCreate, SocialAccountResponse
from services.publisher.src.services.crypto import encrypt_credentials

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("/", response_model=SocialAccountResponse, status_code=201)
async def add_account(
    body: SocialAccountCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SocialAccount:
    """Connect a new social media account."""
    repo = PublishRepository(session)
    account = SocialAccount(
        platform=body.platform,
        display_name=body.display_name,
        credentials=encrypt_credentials(body.credentials),
    )
    created = await repo.create_account(account)
    await session.commit()
    return created


@router.get("/", response_model=list[SocialAccountResponse])
async def list_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SocialAccount]:
    """List connected social accounts (credentials redacted)."""
    repo = PublishRepository(session)
    return await repo.list_accounts()


@router.delete("/{account_id}", status_code=204)
async def remove_account(
    account_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Disconnect a social account."""
    repo = PublishRepository(session)
    deleted = await repo.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")
    await session.commit()
```

- [ ] **Step 10: Create routes/publish.py (stub — workflow wired in Task 10)**

```python
"""Content publishing endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.db.session import get_session

from services.publisher.src.repositories.publish_repo import PublishRepository
from services.publisher.src.schemas import PublishRecordResponse

router = APIRouter(prefix="/api/v1/publish", tags=["publish"])


@router.get("/history", response_model=list[PublishRecordResponse])
async def list_publish_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    content_id: UUID | None = None,
    limit: int = 50,
) -> list:
    """List publish history records."""
    repo = PublishRepository(session)
    return await repo.list_records(content_id=content_id, limit=limit)
```

- [ ] **Step 11: Create main.py**

```python
"""Publisher service entry point."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from orion_common.config import get_settings
from orion_common.db.session import get_engine
from orion_common.health import create_health_router, instrument_app
from orion_common.logging import configure_logging

from services.publisher.src.routes import accounts, publish

configure_logging()
logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("service_starting", service="publisher")
    yield
    logger.info("service_stopping", service="publisher")


app = FastAPI(title="Orion Publisher Service", lifespan=lifespan)

engine = get_engine()
health_router = create_health_router(
    "publisher", redis_url=settings.redis_url, db_engine=engine
)
app.include_router(health_router)
app.include_router(accounts.router)
app.include_router(publish.router)
instrument_app(app, service_name="publisher")
```

- [ ] **Step 12: Create empty __init__.py files and conftest.py**

Create empty `__init__.py` in:
- `services/publisher/src/`
- `services/publisher/src/routes/`
- `services/publisher/src/providers/`
- `services/publisher/src/services/`
- `services/publisher/src/repositories/`
- `services/publisher/tests/`

Create `services/publisher/tests/conftest.py`:

```python
"""Test fixtures for the Publisher service."""
```

- [ ] **Step 13: Commit**

```bash
git add services/publisher/
git commit -m "feat(ORION-91,ORION-95): scaffold Publisher service with safety stub"
```

---

### Task 9: Gateway + Docker — Register Publisher Service

**Files:**
- Modify: `pkg/config/config.go`
- Modify: `internal/gateway/router/router.go`
- Modify: `deploy/docker-compose.yml`

- [ ] **Step 1: Add PublisherURL to config**

In `pkg/config/config.go`, add `PublisherURL string` after `PulseURL` in the struct, and in `Load()`:

```go
PublisherURL: getEnv("PUBLISHER_URL", "http://localhost:8006"),
```

- [ ] **Step 2: Add publisher to services map in router.go**

In the `services` map, add:

```go
"publisher": cfg.PublisherURL,
```

- [ ] **Step 3: Add publisher to docker-compose.yml**

After the `pulse` service block, add:

```yaml
  publisher:
    build:
      context: ../services/publisher
    ports:
      - "8006:8006"
    env_file:
      - ../.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - orion-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8006/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

- [ ] **Step 4: Verify Go compiles**

Run: `go build ./...`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add pkg/config/config.go internal/gateway/router/router.go deploy/docker-compose.yml
git commit -m "feat(ORION-91): register Publisher service in gateway and docker-compose"
```

---

## Chunk 4: X/Twitter Provider (ORION-92) + Publishing Workflow (ORION-93)

### Task 10: X/Twitter Provider Implementation

**Files:**
- Create: `services/publisher/src/providers/twitter.py`
- Create: `services/publisher/tests/test_twitter.py`

- [ ] **Step 1: Write Twitter provider tests**

Create `services/publisher/tests/test_twitter.py`:

```python
"""Tests for X/Twitter provider."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.publisher.src.providers.twitter import TwitterProvider, format_tweet_text


def test_format_tweet_text_under_limit():
    result = format_tweet_text("Hello world", hashtags=["#test"])
    assert result == "Hello world\n\n#test"


def test_format_tweet_text_over_limit():
    long_text = "a" * 280
    result = format_tweet_text(long_text)
    assert len(result) <= 280
    assert result.endswith("…")


def test_format_tweet_text_hashtags_trimmed_if_no_space():
    text = "a" * 270
    result = format_tweet_text(text, hashtags=["#longhashtag"])
    assert "#longhashtag" not in result
    assert len(result) <= 280


def test_character_limit():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )
    assert provider.get_character_limit() == 280


def test_platform_name():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )
    assert provider.get_platform_name() == "twitter"


@pytest.mark.asyncio
async def test_publish_success():
    provider = TwitterProvider(
        api_key="k", api_secret="s", access_token="t", access_token_secret="ts"
    )

    mock_response = MagicMock()
    mock_response.data = {"id": "12345"}

    with patch.object(provider, "_get_client") as mock_client_fn:
        mock_client = AsyncMock()
        mock_client.create_tweet = AsyncMock(return_value=mock_response)
        mock_client_fn.return_value = mock_client

        from services.publisher.src.providers.base import PublishContent
        content = PublishContent(text="Test tweet")
        result = await provider.publish(content)

        assert result.status == "published"
        assert result.platform_post_id == "12345"
        assert result.platform == "twitter"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/publisher && python -m pytest tests/test_twitter.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement Twitter provider**

Create `services/publisher/src/providers/twitter.py`:

```python
"""X/Twitter social media provider using tweepy."""

from __future__ import annotations

import structlog
import tweepy

from services.publisher.src.providers.base import PublishContent, SocialProvider
from services.publisher.src.schemas import PublishResult

logger = structlog.get_logger(__name__)

TWEET_CHAR_LIMIT = 280


def format_tweet_text(
    text: str,
    hashtags: list[str] | None = None,
) -> str:
    """Format text for a tweet, respecting character limits.

    Args:
        text: The main content text.
        hashtags: Optional hashtags to append.

    Returns:
        Formatted tweet text within character limit.
    """
    if hashtags:
        tag_str = " ".join(hashtags)
        candidate = f"{text}\n\n{tag_str}"
        if len(candidate) <= TWEET_CHAR_LIMIT:
            return candidate
        # Try without hashtags if too long
        if len(text) <= TWEET_CHAR_LIMIT:
            return text

    if len(text) > TWEET_CHAR_LIMIT:
        return text[: TWEET_CHAR_LIMIT - 1] + "…"

    return text


class TwitterProvider(SocialProvider):
    """X/Twitter provider using tweepy AsyncClient."""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        access_token: str,
        access_token_secret: str,
    ) -> None:
        self._api_key = api_key
        self._api_secret = api_secret
        self._access_token = access_token
        self._access_token_secret = access_token_secret

    def _get_client(self) -> tweepy.AsyncClient:
        return tweepy.AsyncClient(
            consumer_key=self._api_key,
            consumer_secret=self._api_secret,
            access_token=self._access_token,
            access_token_secret=self._access_token_secret,
        )

    async def publish(self, content: PublishContent) -> PublishResult:
        """Post a tweet with optional media."""
        try:
            client = self._get_client()
            tweet_text = format_tweet_text(content.text, content.hashtags)

            # TODO: Media upload requires v1.1 API — implement when needed
            response = await client.create_tweet(text=tweet_text)
            tweet_id = str(response.data["id"])

            await logger.ainfo(
                "tweet_published",
                tweet_id=tweet_id,
                text_length=len(tweet_text),
            )

            return PublishResult(
                platform="twitter",
                status="published",
                platform_post_id=tweet_id,
            )

        except Exception as exc:
            await logger.aerror("tweet_publish_failed", error=str(exc))
            return PublishResult(
                platform="twitter",
                status="failed",
                error=str(exc),
            )

    async def validate_credentials(self) -> bool:
        """Verify the stored credentials work."""
        try:
            client = self._get_client()
            me = await client.get_me()
            return me.data is not None
        except Exception:
            return False

    def get_character_limit(self) -> int:
        return TWEET_CHAR_LIMIT

    def get_platform_name(self) -> str:
        return "twitter"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/publisher && python -m pytest tests/test_twitter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/publisher/src/providers/twitter.py services/publisher/tests/test_twitter.py
git commit -m "feat(ORION-92): implement X/Twitter provider with tweepy"
```

---

### Task 11: Publishing Workflow — Orchestration Service

**Files:**
- Create: `services/publisher/src/services/publisher.py`
- Modify: `services/publisher/src/routes/publish.py`
- Create: `services/publisher/tests/test_publish_workflow.py`

- [ ] **Step 1: Write workflow tests**

Create `services/publisher/tests/test_publish_workflow.py`:

```python
"""Tests for the publishing workflow."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from services.publisher.src.schemas import PublishResult, SafetyCheckResult
from services.publisher.src.services.publisher import PublishingService


@pytest.mark.asyncio
async def test_publish_rejects_non_approved():
    svc = PublishingService(session=AsyncMock(), event_bus=None)

    mock_content = AsyncMock()
    mock_content.status.value = "draft"

    with patch.object(svc, "_get_content", return_value=mock_content):
        with pytest.raises(ValueError, match="must be in 'approved' status"):
            await svc.publish_content(uuid4(), ["twitter"])


@pytest.mark.asyncio
async def test_publish_rejects_on_safety_failure():
    svc = PublishingService(session=AsyncMock(), event_bus=None)

    mock_content = AsyncMock()
    mock_content.status.value = "approved"
    mock_content.script_body = "bad content"
    mock_content.media_assets = []

    with (
        patch.object(svc, "_get_content", return_value=mock_content),
        patch(
            "services.publisher.src.services.publisher.check_content_safety",
            return_value=SafetyCheckResult(passed=False, violations=["blocked word"]),
        ),
    ):
        with pytest.raises(ValueError, match="Safety check failed"):
            await svc.publish_content(uuid4(), ["twitter"])


@pytest.mark.asyncio
async def test_publish_success():
    mock_session = AsyncMock()
    svc = PublishingService(session=mock_session, event_bus=AsyncMock())

    mock_content = AsyncMock()
    mock_content.id = uuid4()
    mock_content.status.value = "approved"
    mock_content.script_body = "Test content for publishing"
    mock_content.media_assets = []
    mock_content.trend = AsyncMock()
    mock_content.trend.raw_data = {"keywords": ["test"]}

    mock_provider = AsyncMock()
    mock_provider.get_character_limit.return_value = 280
    mock_provider.get_platform_name.return_value = "twitter"
    mock_provider.publish.return_value = PublishResult(
        platform="twitter", status="published", platform_post_id="123"
    )

    with (
        patch.object(svc, "_get_content", return_value=mock_content),
        patch(
            "services.publisher.src.services.publisher.check_content_safety",
            return_value=SafetyCheckResult(passed=True),
        ),
        patch.object(svc, "_get_provider", return_value=mock_provider),
    ):
        response = await svc.publish_content(mock_content.id, ["twitter"])

    assert len(response.results) == 1
    assert response.results[0].status == "published"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/publisher && python -m pytest tests/test_publish_workflow.py -v`
Expected: FAIL

- [ ] **Step 3: Implement publishing service**

Create `services/publisher/src/services/publisher.py`:

```python
"""Publishing workflow orchestration."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from orion_common.db.models import (
    Content,
    ContentStatus,
    PublishRecord,
    PublishStatus,
    SocialAccount,
)
from orion_common.event_bus import EventBus
from orion_common.events import Channels

from services.publisher.src.providers.base import PublishContent, SocialProvider
from services.publisher.src.providers.twitter import TwitterProvider
from services.publisher.src.schemas import PublishResponse, PublishResult
from services.publisher.src.services.crypto import decrypt_credentials
from services.publisher.src.services.safety import check_content_safety

logger = structlog.get_logger(__name__)


class PublishingService:
    """Orchestrates the content publishing workflow."""

    def __init__(self, session: AsyncSession, event_bus: EventBus | None) -> None:
        self.session = session
        self.event_bus = event_bus

    async def publish_content(
        self,
        content_id: UUID,
        platforms: list[str],
    ) -> PublishResponse:
        """Publish approved content to the specified platforms.

        Args:
            content_id: The content to publish.
            platforms: List of platform names (e.g., ["twitter"]).

        Returns:
            PublishResponse with per-platform results.

        Raises:
            ValueError: If content is not approved or safety check fails.
        """
        content = await self._get_content(content_id)

        if content.status.value != "approved":
            raise ValueError(
                f"Content must be in 'approved' status, got '{content.status.value}'"
            )

        # Build text from script_body or title
        text = content.script_body or content.title
        has_media = len(content.media_assets) > 0

        # Run safety check for each platform
        results: list[PublishResult] = []
        any_published = False

        for platform in platforms:
            provider = await self._get_provider(platform)
            if provider is None:
                results.append(
                    PublishResult(
                        platform=platform,
                        status="failed",
                        error=f"No active account for platform '{platform}'",
                    )
                )
                continue

            safety = await check_content_safety(
                text=text,
                has_media=has_media,
                platform_char_limit=provider.get_character_limit(),
            )
            if not safety.passed:
                raise ValueError(
                    f"Safety check failed: {'; '.join(safety.violations)}"
                )

            # Build publish content
            hashtags = []
            if content.trend and content.trend.raw_data:
                hashtags = [
                    f"#{kw}" for kw in content.trend.raw_data.get("keywords", [])[:3]
                ]

            publish_content = PublishContent(
                text=text,
                media_paths=[a.file_path for a in content.media_assets],
                hashtags=hashtags,
            )

            result = await provider.publish(publish_content)
            results.append(result)

            # Record in DB
            record = PublishRecord(
                content_id=content_id,
                platform=platform,
                platform_post_id=result.platform_post_id,
                status=PublishStatus(result.status),
                error_message=result.error,
                published_at=datetime.now(timezone.utc) if result.status == "published" else None,
            )
            self.session.add(record)

            if result.status == "published":
                any_published = True

        # Update content status if at least one platform succeeded
        now = datetime.now(timezone.utc)
        if any_published:
            content.status = ContentStatus.published
            await self.session.flush()

            # Emit event
            if self.event_bus:
                payload = json.dumps({
                    "content_id": str(content_id),
                    "platforms": platforms,
                    "results": [r.model_dump() for r in results],
                    "published_at": now.isoformat(),
                })
                await self.event_bus.publish(Channels.CONTENT_PUBLISHED, payload)

        await self.session.commit()

        return PublishResponse(
            content_id=content_id,
            results=results,
            published_at=now if any_published else None,
        )

    async def _get_content(self, content_id: UUID) -> Content:
        stmt = (
            select(Content)
            .where(Content.id == content_id)
            .options(
                selectinload(Content.media_assets),
                selectinload(Content.trend),
            )
        )
        result = await self.session.execute(stmt)
        content = result.scalar_one_or_none()
        if content is None:
            raise ValueError(f"Content {content_id} not found")
        return content

    async def _get_provider(self, platform: str) -> SocialProvider | None:
        stmt = (
            select(SocialAccount)
            .where(SocialAccount.platform == platform, SocialAccount.is_active.is_(True))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        account = result.scalar_one_or_none()
        if account is None:
            return None

        creds = decrypt_credentials(account.credentials)

        if platform == "twitter":
            return TwitterProvider(
                api_key=creds["api_key"],
                api_secret=creds["api_secret"],
                access_token=creds["access_token"],
                access_token_secret=creds["access_token_secret"],
            )

        return None
```

- [ ] **Step 4: Update routes/publish.py to add POST endpoint**

Replace `services/publisher/src/routes/publish.py` with:

```python
"""Content publishing endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orion_common.config import get_settings
from orion_common.db.session import get_session
from orion_common.event_bus import EventBus

from services.publisher.src.repositories.publish_repo import PublishRepository
from services.publisher.src.schemas import (
    PublishRecordResponse,
    PublishRequest,
    PublishResponse,
)
from services.publisher.src.services.publisher import PublishingService

router = APIRouter(prefix="/api/v1/publish", tags=["publish"])


@router.post("/", response_model=PublishResponse)
async def publish_content(
    body: PublishRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PublishResponse:
    """Publish approved content to social platforms."""
    settings = get_settings()
    event_bus = EventBus(settings.redis_url)

    try:
        svc = PublishingService(session=session, event_bus=event_bus)
        return await svc.publish_content(body.content_id, body.platforms)
    except ValueError as exc:
        status = 409 if "approved" in str(exc) else 422
        raise HTTPException(status_code=status, detail=str(exc))
    finally:
        await event_bus.close()


@router.get("/history", response_model=list[PublishRecordResponse])
async def list_publish_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    content_id: UUID | None = None,
    limit: int = 50,
) -> list:
    """List publish history records."""
    repo = PublishRepository(session)
    return await repo.list_records(content_id=content_id, limit=limit)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/publisher && python -m pytest tests/ -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/publisher/src/services/publisher.py services/publisher/src/routes/publish.py services/publisher/tests/test_publish_workflow.py
git commit -m "feat(ORION-92,ORION-93): implement publishing workflow with X/Twitter provider"
```

---

## Chunk 5: Dashboard Publish UI (ORION-94)

### Task 12: Dashboard Types and Server Actions for Publishing

**Files:**
- Modify: `dashboard/src/types/api.ts`
- Modify: `dashboard/src/lib/actions.ts`

- [ ] **Step 1: Add publish types to api.ts**

At the end of `dashboard/src/types/api.ts`, add:

```typescript
/** A record of content published to a social platform */
export interface PublishRecord {
  id: string;
  content_id: string;
  platform: string;
  platform_post_id: string | null;
  status: "pending" | "published" | "failed";
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

/** Request to publish content */
export interface PublishRequest {
  content_id: string;
  platforms: string[];
}

/** Response from publishing */
export interface PublishResponse {
  content_id: string;
  results: Array<{
    platform: string;
    status: string;
    platform_post_id: string | null;
    error: string | null;
  }>;
  published_at: string | null;
}

/** A connected social media account */
export interface SocialAccount {
  id: string;
  platform: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Add publishContent action to actions.ts**

At the end of `dashboard/src/lib/actions.ts`, add:

```typescript
export async function publishContent(
  contentId: string,
  platforms: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      "/api/v1/publisher/publish/",
      {
        method: "POST",
        body: JSON.stringify({ content_id: contentId, platforms }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: "Publish failed" }));
      return {
        success: false,
        error: body.detail ?? "Failed to publish content",
      };
    }

    revalidatePath("/queue");
    revalidatePath(`/queue/${contentId}`);
    revalidatePath("/publishing");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/types/api.ts dashboard/src/lib/actions.ts
git commit -m "feat(ORION-94): add publish types and server action"
```

---

### Task 13: Publish Modal and Content Actions Update

**Files:**
- Create: `dashboard/src/components/publish-modal.tsx`
- Modify: `dashboard/src/components/content-actions.tsx`

- [ ] **Step 1: Create publish modal**

Create `dashboard/src/components/publish-modal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { publishContent } from "@/lib/actions";

interface PublishModalProps {
  contentId: string;
  onClose: () => void;
}

const PLATFORMS = [
  { id: "twitter", label: "X / Twitter", icon: "𝕏" },
];

export function PublishModal({
  contentId,
  onClose,
}: PublishModalProps): React.ReactElement {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function togglePlatform(id: string): void {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handlePublish(): void {
    if (selected.length === 0) {
      toast("error", "Select at least one platform");
      return;
    }

    startTransition(async () => {
      const result = await publishContent(contentId, selected);
      if (result.success) {
        toast("success", "Content published successfully");
        onClose();
      } else {
        toast("error", result.error ?? "Failed to publish");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Publish Content
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Select platforms to publish to:
        </p>

        <div className="space-y-2">
          {PLATFORMS.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                selected.includes(p.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-lg">{p.icon}</span>
              <span className="text-sm font-medium text-gray-900">
                {p.label}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isPending || selected.length === 0}
            className={cn(
              "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700",
              (isPending || selected.length === 0) &&
                "cursor-not-allowed opacity-60"
            )}
          >
            {isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Publish button to ContentActions**

In `dashboard/src/components/content-actions.tsx`, add the import and state:

```tsx
import { Send } from "lucide-react";
import { PublishModal } from "@/components/publish-modal";
```

Add state inside the `ContentActions` component:

```tsx
const [showPublishModal, setShowPublishModal] = useState(false);
const canPublish = optimisticStatus === "approved";
```

Add the Publish button after the existing "Approved" status display (after the `optimisticStatus === "approved"` span):

```tsx
{canPublish && (
  <button
    onClick={() => setShowPublishModal(true)}
    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
  >
    <Send className="h-4 w-4" />
    Publish
  </button>
)}
```

Add the modal render at the bottom, next to `RejectModal`:

```tsx
{showPublishModal && (
  <PublishModal
    contentId={contentId}
    onClose={() => setShowPublishModal(false)}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/publish-modal.tsx dashboard/src/components/content-actions.tsx
git commit -m "feat(ORION-94): add publish modal and button to content actions"
```

---

### Task 14: Publishing History Page and Sidebar Update

**Files:**
- Create: `dashboard/src/app/(dashboard)/publishing/page.tsx`
- Modify: `dashboard/src/components/sidebar.tsx`

- [ ] **Step 1: Create publishing history page**

Create `dashboard/src/app/(dashboard)/publishing/page.tsx`:

```tsx
import { serverFetch } from "@/lib/server-fetch";
import { cn, formatDate } from "@/lib/utils";
import type { PublishRecord } from "@/types/api";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  published: { label: "Published", className: "bg-green-100 text-green-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

export default async function PublishingPage(): Promise<React.ReactElement> {
  let records: PublishRecord[] = [];

  try {
    const response = await serverFetch("/api/v1/publisher/publish/history?limit=100");
    if (response.ok) {
      records = await response.json();
    }
  } catch {
    // API not available yet
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Publishing History
      </h1>

      {records.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-400">No publishing records yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Approve content and click Publish to get started
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Content
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Post ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((record) => {
                const statusInfo =
                  STATUS_STYLES[record.status] ?? STATUS_STYLES.pending;
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {record.content_id.slice(0, 8)}…
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {record.platform}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusInfo.className
                        )}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {record.published_at
                        ? formatDate(record.published_at)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {record.platform_post_id ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Publishing nav item to sidebar**

In `dashboard/src/components/sidebar.tsx`, add `Send` to the lucide-react import:

```tsx
import {
  BarChart3,
  LayoutDashboard,
  ListVideo,
  TrendingUp,
  Settings,
  Activity,
  Play,
  LogOut,
  Send,
} from "lucide-react";
```

Add the Publishing nav item to `NAV_ITEMS` array, after the Analytics entry:

```tsx
{ label: "Publishing", href: "/publishing", icon: <Send className="h-5 w-5" /> },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: SUCCESS (or pre-existing login page Suspense warning only)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/\(dashboard\)/publishing/page.tsx dashboard/src/components/sidebar.tsx
git commit -m "feat(ORION-94): add publishing history page and sidebar nav"
```

---
