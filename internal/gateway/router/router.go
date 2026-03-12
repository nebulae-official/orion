package router

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/middleware"
	"github.com/orion-rigel/orion/pkg/config"
)

// New creates and returns a fully-configured Chi router with middleware
// and routes for the gateway service.
func New(cfg config.Config, hub *handlers.Hub) (chi.Router, error) {
	r := chi.NewRouter()

	// Middleware stack: RequestID -> Logger -> Recoverer -> CORS
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.Metrics)

	// Health and readiness endpoints.
	r.Get("/health", handlers.Health())
	r.Get("/ready", handlers.Ready())
	r.Handle("/metrics", promhttp.Handler())

	// Service URLs for health aggregation and proxying.
	services := map[string]string{
		"scout":    cfg.ScoutURL,
		"director": cfg.DirectorURL,
		"media":    cfg.MediaURL,
		"editor":   cfg.EditorURL,
		"pulse":    cfg.PulseURL,
	}

	// Aggregated status endpoint — checks all downstream services concurrently.
	r.Get("/status", handlers.Status(services))

	// Auth endpoints (public)
	r.Post("/api/v1/auth/login", handlers.Login(cfg))
	r.Post("/api/v1/auth/refresh", handlers.RefreshToken(cfg))

	// WebSocket endpoint (public — JWT validated from query param inside handler)
	r.Get("/ws", handlers.HandleWebSocket(hub, cfg.JWTSecret))

	// Redis client for rate limiting
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Warn("redis_url_parse_failed, rate limiting disabled", "error", err)
		// Fall back to flat proxy without rate limiting
		return mountFlatProxy(r, services, cfg.JWTSecret)
	}
	rdb := redis.NewClient(opt)

	// Per-service route groups with rate limiting, protected by JWT auth
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(cfg.JWTSecret))

		for name, url := range services {
			proxy, err := handlers.NewServiceProxy(url)
			if err != nil {
				slog.Error("creating proxy failed", "service", name, "error", err)
				return
			}

			rlCfg := rateLimitForService(name)

			protected.Route(fmt.Sprintf("/api/v1/%s", name), func(sub chi.Router) {
				if rlCfg.writeLimit > 0 {
					// Method-aware rate limiting for services with distinct read/write limits
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Post("/*", proxy.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Put("/*", proxy.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Delete("/*", proxy.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					})).Get("/*", proxy.ServeHTTP)
				} else {
					// Single rate limit for all methods
					sub.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					}))
					sub.Handle("/*", proxy)
				}
			})

			slog.Info("registered service proxy",
				"service", name,
				"target", url,
				"rate_limit_group", rlCfg.readGroup,
			)
		}
	})

	return r, nil
}

type serviceRateLimit struct {
	readGroup  string
	readLimit  int
	writeGroup string
	writeLimit int // 0 means same limit for all methods
}

func rateLimitForService(name string) serviceRateLimit {
	switch name {
	case "director":
		return serviceRateLimit{
			readGroup: "content_read", readLimit: 100,
			writeGroup: "content_write", writeLimit: 20,
		}
	case "scout":
		return serviceRateLimit{readGroup: "triggers", readLimit: 10}
	case "pulse", "media", "editor":
		return serviceRateLimit{readGroup: "system", readLimit: 60}
	default:
		return serviceRateLimit{readGroup: "system", readLimit: 60}
	}
}

func mountFlatProxy(r chi.Router, services map[string]string, jwtSecret string) (chi.Router, error) {
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(jwtSecret))

		for name, url := range services {
			proxy, err := handlers.NewServiceProxy(url)
			if err != nil {
				slog.Error("creating proxy failed", "service", name, "error", err)
				return
			}
			pattern := fmt.Sprintf("/api/v1/%s/*", name)
			protected.Handle(pattern, proxy)
			slog.Info("registered service proxy (no rate limit)",
				"service", name,
				"target", url,
				"pattern", pattern,
			)
		}
	})
	return r, nil
}
