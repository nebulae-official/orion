package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/orion-rigel/orion/pkg/auth"
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
			var failed []*websocket.Conn
			h.mu.RLock()
			for conn := range h.clients {
				if err := conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
					failed = append(failed, conn)
					continue
				}
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					failed = append(failed, conn)
				}
			}
			h.mu.RUnlock()
			// Remove failed connections outside the read lock
			for _, conn := range failed {
				h.mu.Lock()
				if _, ok := h.clients[conn]; ok {
					delete(h.clients, conn)
					conn.Close()
				}
				h.mu.Unlock()
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

		// Preferred path: ticket-based auth via Redis (atomic single-use).
		if ticket := r.URL.Query().Get("ticket"); ticket != "" {
			ticketKey := fmt.Sprintf("ws:ticket:%s", ticket)
			val, err := rdb.GetDel(r.Context(), ticketKey).Result()
			if err != nil || val == "" {
				http.Error(w, `{"message":"invalid or expired ticket"}`, http.StatusUnauthorized)
				return
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
				_, err := auth.ValidateToken(tokenStr, jwtSecret)
				if err != nil {
					http.Error(w, `{"message":"invalid token"}`, http.StatusUnauthorized)
					return
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
