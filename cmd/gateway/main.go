package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orion-rigel/orion/internal/gateway/router"
	"github.com/orion-rigel/orion/pkg/config"
)

func main() {
	cfg := config.Load()

	slog.Info("starting gateway",
		"port", cfg.GatewayPort,
		"env", cfg.AppEnv,
	)

	r, err := router.New(cfg)
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

	slog.Info("gateway stopped")
}
