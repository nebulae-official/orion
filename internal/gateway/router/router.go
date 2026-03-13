package router

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
	"github.com/orion-rigel/orion/internal/gateway/middleware"
	"github.com/orion-rigel/orion/internal/gateway/proxy"
	"github.com/orion-rigel/orion/pkg/auth"
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

	// Redis client shared across rate limiter, auth, health, blacklist
	opt, parseErr := redis.ParseURL(cfg.RedisURL)
	var rdb *redis.Client
	if parseErr != nil {
		slog.Warn("redis_url_parse_failed, rate limiting and blacklist disabled", "error", parseErr)
	} else {
		rdb = redis.NewClient(opt)
	}

	// Token blacklist (nil-safe — callers check for nil)
	var blacklist *auth.TokenBlacklist
	if rdb != nil {
		blacklist = auth.NewTokenBlacklist(rdb)
	}

	// Health and readiness endpoints.
	r.Get("/health", handlers.Health(cfg.AppVersion))
	r.Get("/ready", handlers.Ready(cfg.AppVersion, rdb))

	// Metrics behind auth.
	r.Group(func(admin chi.Router) {
		admin.Use(middleware.Auth(cfg.JWTSecret, blacklist))
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

	// Auth endpoints with strict rate limiting (5 req/min per IP)
	authHandler, err := handlers.NewAuthHandler(cfg, rdb)
	if err != nil {
		return nil, fmt.Errorf("creating auth handler: %w", err)
	}
	if rdb != nil {
		authRL := middleware.RateLimit(rdb, middleware.RateLimitConfig{
			Group: "auth", Limit: 5, Window: time.Minute,
		})
		r.With(authRL).Post("/api/v1/auth/login", authHandler.Login())
		r.With(authRL).Post("/api/v1/auth/refresh", authHandler.RefreshToken())
	} else {
		r.Post("/api/v1/auth/login", authHandler.Login())
		r.Post("/api/v1/auth/refresh", authHandler.RefreshToken())
	}

	// Logout endpoint (protected)
	r.Group(func(logoutGroup chi.Router) {
		logoutGroup.Use(middleware.Auth(cfg.JWTSecret, blacklist))
		logoutGroup.Post("/api/v1/auth/logout", authHandler.Logout(blacklist))
	})

	// WebSocket ticket endpoint (protected)
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(cfg.JWTSecret, blacklist))
		protected.Post("/api/v1/ws/ticket", authHandler.IssueWSTicket())
	})

	// WebSocket endpoint (public — auth validated inside handler via Redis)
	r.Get("/ws", handlers.HandleWebSocket(hub, rdb, cfg.JWTSecret, cfg.AllowedOrigins, cfg.IsDevelopment()))

	if rdb == nil {
		// Fall back to flat proxy without rate limiting
		return mountFlatProxy(r, services, cfg.JWTSecret, blacklist)
	}

	// Build proxies before entering the route group so errors can be returned.
	type serviceProxy struct {
		name    string
		url     string
		handler http.Handler
		rlCfg   serviceRateLimit
	}

	var proxies []serviceProxy
	for name, url := range services {
		svcProxy, err := handlers.NewServiceProxy(url)
		if err != nil {
			return nil, fmt.Errorf("creating proxy for %s: %w", name, err)
		}

		cb := proxy.NewCircuitBreaker(name)
		guarded := cb.Wrap(svcProxy)

		proxies = append(proxies, serviceProxy{
			name:    name,
			url:     url,
			handler: guarded,
			rlCfg:   rateLimitForService(name),
		})
	}

	// Per-service route groups with rate limiting, protected by JWT auth
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(cfg.JWTSecret, blacklist))

		for _, sp := range proxies {
			handler := sp.handler
			rlCfg := sp.rlCfg

			protected.Route(fmt.Sprintf("/api/v1/%s", sp.name), func(sub chi.Router) {
				if rlCfg.writeLimit > 0 {
					// Method-aware rate limiting for services with distinct read/write limits
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Post("/*", handler.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Put("/*", handler.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.writeGroup, Limit: rlCfg.writeLimit, Window: time.Minute,
					})).Delete("/*", handler.ServeHTTP)
					sub.With(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					})).Get("/*", handler.ServeHTTP)
				} else {
					// Single rate limit for all methods
					sub.Use(middleware.RateLimit(rdb, middleware.RateLimitConfig{
						Group: rlCfg.readGroup, Limit: rlCfg.readLimit, Window: time.Minute,
					}))
					sub.Handle("/*", handler)
				}
			})

			slog.Info("registered service proxy",
				"service", sp.name,
				"target", sp.url,
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

func mountFlatProxy(r chi.Router, services map[string]string, jwtSecret string, bl *auth.TokenBlacklist) (chi.Router, error) {
	// Build proxies before route group so errors propagate to caller.
	type flatEntry struct {
		name    string
		url     string
		handler http.Handler
	}

	var entries []flatEntry
	for name, url := range services {
		svcProxy, err := handlers.NewServiceProxy(url)
		if err != nil {
			return nil, fmt.Errorf("creating proxy for %s: %w", name, err)
		}
		cb := proxy.NewCircuitBreaker(name)
		guarded := cb.Wrap(svcProxy)
		entries = append(entries, flatEntry{name: name, url: url, handler: guarded})
	}

	r.Group(func(protected chi.Router) {
		protected.Use(middleware.Auth(jwtSecret, bl))

		for _, e := range entries {
			pattern := fmt.Sprintf("/api/v1/%s/*", e.name)
			protected.Handle(pattern, e.handler)
			slog.Info("registered service proxy (no rate limit)",
				"service", e.name,
				"target", e.url,
				"pattern", pattern,
			)
		}
	})
	return r, nil
}
