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
	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/redis/go-redis/v9"
)

func dialTestWS(t *testing.T, hub *handlers.Hub, rdb *redis.Client, userID string) *websocket.Conn {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.HandleWebSocket(hub, rdb, "test-secret", nil, true)(w, r)
	}))
	t.Cleanup(srv.Close)

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID, "exp": float64(9999999999),
	})
	tokenStr, _ := tok.SignedString([]byte("test-secret"))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tokenStr
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("ws dial failed: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestPipelineRelay_DeliversToTargetUser(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartPipelineProgressRelay(ctx, rdb, hub)

	conn := dialTestWS(t, hub, rdb, "user-abc")
	time.Sleep(50 * time.Millisecond)

	// Publish a pipeline stage changed event
	payload := map[string]interface{}{
		"content_id":       "content-123",
		"user_id":          "user-abc",
		"stage":            "strategist",
		"stages_completed": 1,
		"stages_total":     5,
		"status":           "running",
	}
	payloadBytes, _ := json.Marshal(payload)
	rdb.Publish(ctx, "orion.pipeline.stage_changed", string(payloadBytes))

	// Read the WebSocket message
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read message failed: %v", err)
	}

	var received handlers.WSMessage
	if err := json.Unmarshal(data, &received); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if received.Type != "pipeline_progress" {
		t.Errorf("got type %q, want %q", received.Type, "pipeline_progress")
	}

	var progress map[string]interface{}
	if err := json.Unmarshal(received.Payload, &progress); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if progress["stage"] != "strategist" {
		t.Errorf("got stage %q, want %q", progress["stage"], "strategist")
	}
	if progress["content_id"] != "content-123" {
		t.Errorf("got content_id %q, want %q", progress["content_id"], "content-123")
	}
}

func TestPipelineRelay_BroadcastsWhenNoUserID(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartPipelineProgressRelay(ctx, rdb, hub)

	conn := dialTestWS(t, hub, rdb, "user-xyz")
	time.Sleep(50 * time.Millisecond)

	// Publish without user_id — should broadcast
	payload := map[string]interface{}{
		"content_id":       "content-456",
		"stage":            "editor",
		"stages_completed": 3,
		"stages_total":     5,
		"status":           "running",
	}
	payloadBytes, _ := json.Marshal(payload)
	rdb.Publish(ctx, "orion.pipeline.stage_changed", string(payloadBytes))

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read message failed: %v", err)
	}

	var received handlers.WSMessage
	if err := json.Unmarshal(data, &received); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if received.Type != "pipeline_progress" {
		t.Errorf("got type %q, want %q", received.Type, "pipeline_progress")
	}
}

func TestPipelineRelay_DoesNotDeliverToWrongUser(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartPipelineProgressRelay(ctx, rdb, hub)

	conn := dialTestWS(t, hub, rdb, "user-xyz")
	time.Sleep(50 * time.Millisecond)

	// Publish for a different user
	payload := map[string]interface{}{
		"content_id":       "content-789",
		"user_id":          "user-other",
		"stage":            "media",
		"stages_completed": 2,
		"stages_total":     5,
		"status":           "running",
	}
	payloadBytes, _ := json.Marshal(payload)
	rdb.Publish(ctx, "orion.pipeline.stage_changed", string(payloadBytes))

	_ = conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected no message for wrong user, but got one")
	}
}

func TestPipelineRelay_InvalidPayload(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handlers.StartPipelineProgressRelay(ctx, rdb, hub)

	// Publish invalid JSON — should not panic
	rdb.Publish(ctx, "orion.pipeline.stage_changed", "not-json")
	time.Sleep(50 * time.Millisecond)
}

func TestPipelineRelay_ContextCancellation(t *testing.T) {
	hub := handlers.NewHub()
	go hub.Run()
	defer hub.Stop()

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx, cancel := context.WithCancel(context.Background())
	handlers.StartPipelineProgressRelay(ctx, rdb, hub)

	cancel()
	time.Sleep(50 * time.Millisecond)
}
