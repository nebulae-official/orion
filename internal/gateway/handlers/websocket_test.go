package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestHub_BroadcastReachesClient(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	// Create test server with WebSocket handler (dev mode for token auth)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret", true)(w, r)
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
		handlers.HandleWebSocket(hub, "test-secret", true)(w, r)
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

	// Production mode (isDevelopment = false, the default)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret")(w, r)
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

	// Production mode — ticket auth should work
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret")(w, r)
	}))
	defer srv.Close()

	// Store a valid ticket
	handlers.WSTicketStore.Store("test-ticket-123", 30*time.Second)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?ticket=test-ticket-123"
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

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, "test-secret")(w, r)
	}))
	defer srv.Close()

	// Store a ticket that expires immediately
	handlers.WSTicketStore.Store("expired-ticket", 0)

	// Small sleep to ensure it's expired
	time.Sleep(1 * time.Millisecond)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?ticket=expired-ticket"
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected expired ticket to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", resp.StatusCode)
	}
}
