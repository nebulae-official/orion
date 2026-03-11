package router

import (
	"fmt"
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/middleware"
	"github.com/orion-rigel/orion/pkg/config"
)

// New creates and returns a fully-configured Chi router with middleware
// and routes for the gateway service.
func New(cfg config.Config) (chi.Router, error) {
	r := chi.NewRouter()

	// Middleware stack: RequestID -> Logger -> Recoverer -> CORS
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CORS)

	// Health and readiness endpoints.
	r.Get("/health", handlers.Health())
	r.Get("/ready", handlers.Ready())

	// Service proxy routes.
	services := map[string]string{
		"scout":    cfg.ScoutURL,
		"director": cfg.DirectorURL,
		"media":    cfg.MediaURL,
		"editor":   cfg.EditorURL,
		"pulse":    cfg.PulseURL,
	}

	for name, url := range services {
		proxy, err := handlers.NewServiceProxy(url)
		if err != nil {
			return nil, fmt.Errorf("creating proxy for %s: %w", name, err)
		}

		pattern := fmt.Sprintf("/api/v1/%s/*", name)
		r.Handle(pattern, proxy)

		slog.Info("registered service proxy",
			"service", name,
			"target", url,
			"pattern", pattern,
		)
	}

	return r, nil
}
