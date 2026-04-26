package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

type notificationPayload struct {
	UserID       string          `json:"user_id"`
	Notification json.RawMessage `json:"notification"`
}

// pipelineProgressPayload represents the JSON structure published on the
// orion.pipeline.stage_changed Redis channel.
type pipelineProgressPayload struct {
	ContentID       string `json:"content_id"`
	UserID          string `json:"user_id"`
	Stage           string `json:"stage"`
	StagesCompleted int    `json:"stages_completed"`
	StagesTotal     int    `json:"stages_total"`
	Status          string `json:"status"`
}

// StartNotificationRelay subscribes to the notification.created Redis channel
// and relays messages to the appropriate WebSocket user.
func StartNotificationRelay(ctx context.Context, rdb *redis.Client, hub *Hub) {
	pubsub := rdb.Subscribe(ctx, "orion.notification.created")
	ch := pubsub.Channel()

	go func() {
		defer pubsub.Close()
		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var payload notificationPayload
				if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
					slog.Error("notification_relay_unmarshal", "error", err)
					continue
				}
				hub.SendToUser(payload.UserID, WSMessage{
					Type:      "notification",
					Payload:   payload.Notification,
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				})
			case <-ctx.Done():
				return
			}
		}
	}()

	slog.Info("notification_relay_started")
}

// StartPipelineProgressRelay subscribes to the orion.pipeline.stage_changed
// Redis channel and relays pipeline progress events to the appropriate
// WebSocket user. If the payload has no user_id, the message is broadcast
// to all connected clients.
func StartPipelineProgressRelay(ctx context.Context, rdb *redis.Client, hub *Hub) {
	pubsub := rdb.Subscribe(ctx, "orion.pipeline.stage_changed")
	ch := pubsub.Channel()

	go func() {
		defer pubsub.Close()
		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var payload pipelineProgressPayload
				if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
					slog.Error("pipeline_relay_unmarshal", "error", err)
					continue
				}

				data, err := json.Marshal(payload)
				if err != nil {
					slog.Error("pipeline_relay_marshal", "error", err)
					continue
				}

				wsMsg := WSMessage{
					Type:      "pipeline_progress",
					Payload:   json.RawMessage(data),
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				}

				if payload.UserID == "" {
					hub.Broadcast(wsMsg)
				} else {
					hub.SendToUser(payload.UserID, wsMsg)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	slog.Info("pipeline_progress_relay_started")
}
