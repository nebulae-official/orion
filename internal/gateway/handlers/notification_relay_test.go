package handlers_test

import (
	"context"
	"encoding/json"
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

func TestNotificationRelay_DeliversToTargetUser(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start the relay
	handlers.StartNotificationRelay(ctx, rdb, hub)

	// Connect a WebSocket client as user "user-abc"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-abc", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	// Give hub time to register the connection
	time.Sleep(50 * time.Millisecond)

	// Publish a notification event to Redis
	payload := map[string]interface{}{
		"user_id": "user-abc",
		"notification": map[string]interface{}{
			"id":         "notif-1",
			"type":       "trend.detected",
			"title":      "New trend detected: AI Coding",
			"is_read":    false,
			"created_at": "2026-03-20T12:00:00Z",
		},
	}
	payloadBytes, _ := json.Marshal(payload)
	rdb.Publish(ctx, "orion.notification.created", string(payloadBytes))

	// Read the message from WebSocket
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read message failed: %v", err)
	}

	var received handlers.WSMessage
	if err := json.Unmarshal(data, &received); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if received.Type != "notification" {
		t.Errorf("got type %q, want %q", received.Type, "notification")
	}

	// Verify the notification payload
	var notif map[string]interface{}
	if err := json.Unmarshal(received.Payload, &notif); err != nil {
		t.Fatalf("unmarshal notification payload failed: %v", err)
	}
	if notif["title"] != "New trend detected: AI Coding" {
		t.Errorf("got title %q, want %q", notif["title"], "New trend detected: AI Coding")
	}
}

func TestNotificationRelay_DoesNotDeliverToWrongUser(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartNotificationRelay(ctx, rdb, hub)

	// Connect as user "user-xyz"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	defer srv.Close()

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-xyz", "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	defer conn.Close()

	time.Sleep(50 * time.Millisecond)

	// Publish notification for a DIFFERENT user
	payload := map[string]interface{}{
		"user_id": "user-other",
		"notification": map[string]interface{}{
			"id":    "notif-2",
			"type":  "content.published",
			"title": "Content published: Other's Video",
		},
	}
	payloadBytes, _ := json.Marshal(payload)
	rdb.Publish(ctx, "orion.notification.created", string(payloadBytes))

	// Expect no message — set a short deadline
	_ = conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err = conn.ReadMessage()
	if err == nil {
		t.Fatal("expected no message for wrong user, but got one")
	}
}

func TestNotificationRelay_ContextCancellation(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())

	handlers.StartNotificationRelay(ctx, rdb, hub)

	// Cancel the context — relay should shut down without panics
	cancel()

	// Brief pause to let the goroutine exit
	time.Sleep(50 * time.Millisecond)
}

func TestNotificationRelay_InvalidPayload(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartNotificationRelay(ctx, rdb, hub)

	// Publish invalid JSON — should not panic
	rdb.Publish(ctx, "orion.notification.created", "not-json")

	// Brief pause to verify no crash
	time.Sleep(50 * time.Millisecond)
}
