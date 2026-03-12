package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/router"
	"github.com/orion-rigel/orion/pkg/config"
)

func main() {
	cfg := config.Load()

	slog.Info("starting gateway",
		"port", cfg.GatewayPort,
		"env", cfg.AppEnv,
	)

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
	if err != nil {
		slog.Error("failed to create router", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.GatewayPort,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Graceful shutdown on SIGINT / SIGTERM.
	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	slog.Info("gateway listening", "addr", srv.Addr)

	<-done
	slog.Info("shutting down gateway")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	hub.Stop()
	slog.Info("gateway stopped")
}
