package handlers

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/redis/go-redis/v9"
)

type notificationPayload struct {
	UserID       string          `json:"user_id"`
	Notification json.RawMessage `json:"notification"`
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
					Type:    "notification",
					Payload: payload.Notification,
				})
			case <-ctx.Done():
				return
			}
		}
	}()

	slog.Info("notification_relay_started")
}
