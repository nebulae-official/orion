package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func setupTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return mr, rdb
}

func TestHub_BroadcastReachesClient(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	// Create test server with WebSocket handler (dev mode for token auth)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	// Generate valid token
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "admin", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	// Connect WebSocket using legacy token auth (dev mode)
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
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
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

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
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

func TestWebSocket_TokenRejectedInProduction(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	// Production mode (isDevelopment = false, the default)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil)(w, r)
	}))
	defer srv.Close()

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "admin", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected connection to be rejected in production mode")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", resp.StatusCode)
	}
}

func TestWebSocket_TicketAuth(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr, rdb := setupTestRedis(t)
	defer rdb.Close()

	// Production mode — ticket auth should work
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil)(w, r)
	}))
	defer srv.Close()

	// Store a valid ticket in Redis (matching what IssueWSTicket does)
	ticket := "test-ticket-123"
	_ = mr.Set(fmt.Sprintf("ws:ticket:%s", ticket), "valid")
	mr.SetTTL(fmt.Sprintf("ws:ticket:%s", ticket), 30*time.Second)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?ticket=" + ticket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial with ticket failed: %v", err)
	}
	defer conn.Close()

	// Verify the ticket is single-use — second attempt should fail
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected second use of ticket to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", resp.StatusCode)
	}
}

func TestWebSocket_ExpiredTicket(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil)(w, r)
	}))
	defer srv.Close()

	// Store a ticket and immediately expire it via miniredis
	ticket := "expired-ticket"
	_ = mr.Set(fmt.Sprintf("ws:ticket:%s", ticket), "valid")
	mr.SetTTL(fmt.Sprintf("ws:ticket:%s", ticket), 1*time.Millisecond)

	// Fast-forward miniredis time to expire the key
	mr.FastForward(1 * time.Second)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?ticket=" + ticket
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected expired ticket to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", resp.StatusCode)
	}
}
