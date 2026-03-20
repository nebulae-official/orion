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

func TestHub_SendToUser_ReachesCorrectUser(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	// Connect two users
	connectUser := func(userID string) *websocket.Conn {
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": userID, "exp": float64(9999999999),
		})
		tokenStr, _ := tok.SignedString([]byte("test-secret"))
		wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("ws dial for %s failed: %v", userID, err)
		}
		return conn
	}

	connA := connectUser("user-a")
	defer connA.Close()
	connB := connectUser("user-b")
	defer connB.Close()

	// Give the hub time to register both connections
	time.Sleep(50 * time.Millisecond)

	// Send targeted message to user-a only
	msg := handlers.WSMessage{
		Type:    "notification",
		Payload: json.RawMessage(`{"title":"For user-a"}`),
	}
	hub.SendToUser("user-a", msg)

	// user-a should receive the message
	_ = connA.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := connA.ReadMessage()
	if err != nil {
		t.Fatalf("user-a read failed: %v", err)
	}

	var received handlers.WSMessage
	if err := json.Unmarshal(data, &received); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if received.Type != "notification" {
		t.Errorf("user-a got type %q, want %q", received.Type, "notification")
	}

	// user-b should NOT receive the message
	_ = connB.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err = connB.ReadMessage()
	if err == nil {
		t.Fatal("user-b received a message intended for user-a")
	}
}

func TestHub_SendToUser_MultipleConnections(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	// Connect same user twice (simulating multiple browser tabs)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "multi-tab-user", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr

	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial 1 failed: %v", err)
	}
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial 2 failed: %v", err)
	}
	defer conn2.Close()

	time.Sleep(50 * time.Millisecond)

	// Send targeted message
	msg := handlers.WSMessage{
		Type:    "notification",
		Payload: json.RawMessage(`{"title":"Both tabs"}`),
	}
	hub.SendToUser("multi-tab-user", msg)

	// Both connections should receive the message
	for i, conn := range []*websocket.Conn{conn1, conn2} {
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("connection %d read failed: %v", i+1, err)
		}

		var received handlers.WSMessage
		if err := json.Unmarshal(data, &received); err != nil {
			t.Fatalf("connection %d unmarshal failed: %v", i+1, err)
		}
		if received.Type != "notification" {
			t.Errorf("connection %d got type %q, want %q", i+1, received.Type, "notification")
		}
	}
}

func TestHub_SendToUser_NoConnections(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	// SendToUser for a user with no connections should not panic
	msg := handlers.WSMessage{
		Type:    "notification",
		Payload: json.RawMessage(`{"title":"No one home"}`),
	}
	hub.SendToUser("nonexistent-user", msg)

	// Brief pause to ensure no panic in the run loop
	time.Sleep(50 * time.Millisecond)
}

func TestHub_BroadcastStillWorks(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	// Connect two different users
	connectUser := func(userID string) *websocket.Conn {
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": userID, "exp": float64(9999999999),
		})
		tokenStr, _ := tok.SignedString([]byte("test-secret"))
		wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("ws dial for %s failed: %v", userID, err)
		}
		return conn
	}

	connA := connectUser("broadcast-a")
	defer connA.Close()
	connB := connectUser("broadcast-b")
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	// Broadcast should reach both users
	msg := handlers.WSMessage{
		Type:      "system.update",
		Payload:   json.RawMessage(`{"version":"2.0"}`),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	hub.Broadcast(msg)

	for i, conn := range []*websocket.Conn{connA, connB} {
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("user %d read failed: %v", i+1, err)
		}
		var received handlers.WSMessage
		if err := json.Unmarshal(data, &received); err != nil {
			t.Fatalf("user %d unmarshal failed: %v", i+1, err)
		}
		if received.Type != "system.update" {
			t.Errorf("user %d got type %q, want %q", i+1, received.Type, "system.update")
		}
	}
}

func TestHub_UnregisterCleansUpUserConnections(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	_, rdb := setupTestRedis(t)
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "disconnect-user", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	// Close the connection
	conn.Close()
	time.Sleep(100 * time.Millisecond)

	// SendToUser should not panic after the connection is cleaned up
	msg := handlers.WSMessage{
		Type:    "notification",
		Payload: json.RawMessage(`{"title":"After disconnect"}`),
	}
	hub.SendToUser("disconnect-user", msg)

	time.Sleep(50 * time.Millisecond)
}
