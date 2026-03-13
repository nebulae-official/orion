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
	"github.com/orion-rigel/orion/internal/gateway/proxy"
	"github.com/orion-rigel/orion/pkg/config"
)

// New creates and returns a fully-configured Chi router with middleware
// and routes for the gateway service.
func New(cfg config.Config, hub *handlers.Hub) (chi.Router, error) {
	r := chi.NewRouter()

	// Middleware stack: RequestID -> Logger -> Recoverer -> Security -> CORS -> Metrics -> MaxBody
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.SecurityHeaders(cfg.IsDevelopment()))
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.Metrics)
	r.Use(middleware.MaxBodySize(5 << 20)) // 5 MB

	// Redis client shared across rate limiter, auth, health
	opt, parseErr := redis.ParseURL(cfg.RedisURL)
	var rdb *redis.Client
	if parseErr != nil {
		slog.Warn("redis_url_parse_failed, rate limiting disabled", "error", parseErr)
	} else {
		rdb = redis.NewClient(opt)
	}

	// Health and readiness endpoints.
	r.Get("/health", handlers.Health(cfg.AppVersion))
	r.Get("/ready", handlers.Ready(cfg.AppVersion, rdb))

	// Metrics and status behind auth.
	r.Group(func(admin chi.Router) {
		admin.Use(middleware.Auth(cfg.JWTSecret))
		admin.Handle("/metrics", promhttp.Handler())
	})

	// Service URLs for health aggregation and proxying.
	services := map[string]string{
		"scout":     cfg.ScoutURL,
		"director":  cfg.DirectorURL,
		"media":     cfg.MediaURL,
		"editor":    cfg.EditorURL,
		"pulse":     cfg.PulseURL,
		"publisher": cfg.PublisherURL,
	}

	// Aggregated status endpoint — checks all downstream services concurrently.
	r.Get("/status", handlers.Status(services))

	// Auth endpoints (public)
	authHandler, err := handlers.NewAuthHandler(cfg, rdb)
	if err != nil {
		return nil, fmt.Errorf("creating auth handler: %w", err)
	}
	r.Post("/api/v1/auth/login", authHandler.Login())
	r.Post("/api/v1/auth/refresh", authHandler.RefreshToken())

	// WebSocket ticket endpoint (protected)
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(cfg.JWTSecret))
		protected.Post("/api/v1/ws/ticket", authHandler.IssueWSTicket())
	})

	// WebSocket endpoint (public — auth validated inside handler)
	r.Get("/ws", handlers.HandleWebSocket(hub, cfg.JWTSecret, cfg.IsDevelopment()))

	if rdb == nil {
		// Fall back to flat proxy without rate limiting
		return mountFlatProxy(r, services, cfg.JWTSecret)
	}

	// Per-service route groups with rate limiting, protected by JWT auth
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(cfg.JWTSecret))

		for name, url := range services {
			svcProxy, err := handlers.NewServiceProxy(url)
			if err != nil {
				slog.Error("creating proxy failed", "service", name, "error", err)
				return
			}

			// Wrap the proxy with a circuit breaker per service.
			cb := proxy.NewCircuitBreaker(name)
			guarded := cb.Wrap(svcProxy)

			rlCfg := rateLimitForService(name)

			protected.Route(fmt.Sprintf("/api/v1/%s", name), func(sub chi.Router) {
				if rlCfg.writeLimit > 0 {
					// Method-aware rate limiting for services with distinct read/write limits
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Post("/*", guarded.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Put("/*", guarded.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Delete("/*", guarded.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					})).Get("/*", guarded.ServeHTTP)
				} else {
					// Single rate limit for all methods
					sub.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					}))
					sub.Handle("/*", guarded)
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
			svcProxy, err := handlers.NewServiceProxy(url)
			if err != nil {
				slog.Error("creating proxy failed", "service", name, "error", err)
				return
			}
			cb := proxy.NewCircuitBreaker(name)
			guarded := cb.Wrap(svcProxy)

			pattern := fmt.Sprintf("/api/v1/%s/*", name)
			protected.Handle(pattern, guarded)
			slog.Info("registered service proxy (no rate limit)",
				"service", name,
				"target", url,
				"pattern", pattern,
			)
		}
	})
	return r, nil
}
