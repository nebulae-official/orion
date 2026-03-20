package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/orion-rigel/orion/pkg/auth"
	"github.com/redis/go-redis/v9"
)

// newUpgrader creates a WebSocket upgrader that validates the Origin header
// against the provided allowed origins. In dev mode (empty list), all origins
// are accepted.
func newUpgrader(allowedOrigins []string) websocket.Upgrader {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			if len(allowed) == 0 {
				return true // dev mode — no origins configured
			}
			origin := r.Header.Get("Origin")
			_, ok := allowed[origin]
			return ok
		},
	}
}

// WSMessage is the JSON structure sent to WebSocket clients.
type WSMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp string          `json:"timestamp"`
}

// ClientConn associates a WebSocket connection with an authenticated user.
type ClientConn struct {
	Conn   *websocket.Conn
	UserID string
}

// TargetedMessage carries a message destined for a specific user.
type TargetedMessage struct {
	UserID string
	Msg    WSMessage
}

// Hub manages WebSocket client connections, broadcasts, and per-user targeting.
type Hub struct {
	// Per-user connection tracking
	userConns map[string]map[*websocket.Conn]struct{} // user_id → set of connections
	connUser  map[*websocket.Conn]string               // conn → user_id (reverse lookup)
	mu        sync.RWMutex
	broadcast chan WSMessage
	targeted  chan TargetedMessage
	register  chan *ClientConn
	unregister chan *websocket.Conn
	done      chan struct{}
}

// NewHub creates a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		userConns:  make(map[string]map[*websocket.Conn]struct{}),
		connUser:   make(map[*websocket.Conn]string),
		broadcast:  make(chan WSMessage, 256),
		targeted:   make(chan TargetedMessage, 256),
		register:   make(chan *ClientConn),
		unregister: make(chan *websocket.Conn),
		done:       make(chan struct{}),
	}
}

// Run starts the hub event loop. Call in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case cc := <-h.register:
			h.mu.Lock()
			if h.userConns[cc.UserID] == nil {
				h.userConns[cc.UserID] = make(map[*websocket.Conn]struct{})
			}
			h.userConns[cc.UserID][cc.Conn] = struct{}{}
			h.connUser[cc.Conn] = cc.UserID
			h.mu.Unlock()
			slog.Info("ws_client_connected", "user_id", cc.UserID, "total", len(h.connUser))

		case conn := <-h.unregister:
			h.mu.Lock()
			if uid, ok := h.connUser[conn]; ok {
				delete(h.userConns[uid], conn)
				if len(h.userConns[uid]) == 0 {
					delete(h.userConns, uid)
				}
				delete(h.connUser, conn)
				conn.Close()
			}
			h.mu.Unlock()
			slog.Info("ws_client_disconnected", "total", len(h.connUser))

		case msg := <-h.broadcast:
			data, err := json.Marshal(msg)
			if err != nil {
				slog.Error("ws_marshal_error", "error", err)
				continue
			}
			var failed []*websocket.Conn
			h.mu.RLock()
			for conn := range h.connUser {
				if err := conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
					failed = append(failed, conn)
					continue
				}
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					failed = append(failed, conn)
				}
			}
			h.mu.RUnlock()
			for _, conn := range failed {
				h.unregister <- conn
			}

		case tm := <-h.targeted:
			data, err := json.Marshal(tm.Msg)
			if err != nil {
				slog.Error("ws_marshal_error", "error", err)
				continue
			}
			h.mu.RLock()
			conns := h.userConns[tm.UserID]
			var failed []*websocket.Conn
			for conn := range conns {
				if err := conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
					failed = append(failed, conn)
					continue
				}
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					failed = append(failed, conn)
				}
			}
			h.mu.RUnlock()
			for _, conn := range failed {
				h.unregister <- conn
			}

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

// SendToUser sends a message to all connections for a specific user.
func (h *Hub) SendToUser(userID string, msg WSMessage) {
	select {
	case h.targeted <- TargetedMessage{UserID: userID, Msg: msg}:
	default:
		slog.Warn("ws_targeted_buffer_full", "user_id", userID)
	}
}

// Stop shuts down the hub.
func (h *Hub) Stop() {
	close(h.done)
	h.mu.Lock()
	for conn := range h.connUser {
		conn.Close()
	}
	h.mu.Unlock()
}

// HandleWebSocket returns an HTTP handler that upgrades to WebSocket.
//
// Authentication is performed via one of two mechanisms:
//  1. ?ticket= — a single-use, short-lived ticket obtained from the REST API
//     and stored in Redis. This is the preferred (and only production) auth path.
//  2. ?token=  — a raw JWT passed in the query string. This is ONLY available
//     when isDevelopment is true and logs a warning on every use.
func HandleWebSocket(hub *Hub, rdb *redis.Client, jwtSecret string, allowedOrigins []string, isDevelopment ...bool) http.HandlerFunc {
	devMode := len(isDevelopment) > 0 && isDevelopment[0]
	upgrader := newUpgrader(allowedOrigins)

	return func(w http.ResponseWriter, r *http.Request) {
		var authenticated bool
		var userID string

		// Preferred path: ticket-based auth via Redis (atomic single-use).
		if ticket := r.URL.Query().Get("ticket"); ticket != "" {
			ticketKey := fmt.Sprintf("ws:ticket:%s", ticket)
			val, err := rdb.GetDel(r.Context(), ticketKey).Result()
			if err != nil || val == "" {
				http.Error(w, `{"message":"invalid or expired ticket"}`, http.StatusUnauthorized)
				return
			}
			var identity map[string]string
			if json.Unmarshal([]byte(val), &identity) == nil {
				userID = identity["user_id"]
				slog.Info("ws_ticket_authenticated",
					"user_id", identity["user_id"],
					"name", identity["name"],
					"role", identity["role"],
					"remote_addr", r.RemoteAddr,
				)
			}
			authenticated = true
		}

		// Legacy path: raw JWT in query parameter (dev-only).
		if !authenticated {
			tokenStr := r.URL.Query().Get("token")
			if tokenStr != "" {
				if !devMode {
					http.Error(w, `{"message":"token query auth is disabled in production, use ticket"}`, http.StatusUnauthorized)
					return
				}
				slog.Warn("ws_auth_via_deprecated_token_param",
					"remote_addr", r.RemoteAddr,
					"hint", "use ?ticket= auth instead — ?token= is dev-only and will be removed",
				)
				token, err := auth.ValidateToken(tokenStr, jwtSecret)
				if err != nil {
					http.Error(w, `{"message":"invalid token"}`, http.StatusUnauthorized)
					return
				}
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					if sub, ok := claims["sub"].(string); ok {
						userID = sub
					}
				}
				authenticated = true
			}
		}

		if !authenticated {
			http.Error(w, `{"message":"missing ticket"}`, http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws_upgrade_failed", "error", err)
			return
		}

		hub.register <- &ClientConn{Conn: conn, UserID: userID}

		// Read pump — keeps connection alive and detects disconnect
		go func() {
			defer func() { hub.unregister <- conn }()
			conn.SetReadLimit(512)
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			conn.SetPongHandler(func(string) error {
				return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
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
