package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimitConfig configures rate limiting for a route group.
type RateLimitConfig struct {
	Group  string
	Limit  int
	Window time.Duration
}

// RateLimit returns Chi-compatible middleware that enforces a sliding window
// rate limit using Redis. Requests exceeding the limit receive 429.
func RateLimit(rdb *redis.Client, cfg RateLimitConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			identifier := extractIdentifier(r)

			windowStart := time.Now().Truncate(cfg.Window)
			key := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Unix())
			prevKey := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Add(-cfg.Window).Unix())

			allowed, remaining, err := checkRateLimit(ctx, rdb, key, prevKey, cfg)
			if err != nil {
				// On Redis failure, allow the request (fail open)
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
			resetTime := windowStart.Add(cfg.Window)
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

			if !allowed {
				retryAfter := int(time.Until(resetTime).Seconds()) + 1
				if retryAfter < 1 {
					retryAfter = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)

				errResp := map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": fmt.Sprintf("Rate limit exceeded for %s. Try again in %ds.", cfg.Group, retryAfter),
						"status":  http.StatusTooManyRequests,
					},
				}
				json.NewEncoder(w).Encode(errResp)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func checkRateLimit(
	ctx context.Context,
	rdb *redis.Client,
	key, prevKey string,
	cfg RateLimitConfig,
) (allowed bool, remaining int, err error) {
	// Increment current window
	count, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, fmt.Errorf("redis incr: %w", err)
	}

	// Set expiry on first increment
	if count == 1 {
		rdb.Expire(ctx, key, cfg.Window*2)
	}

	// Get previous window count for sliding calculation
	prevCount, _ := rdb.Get(ctx, prevKey).Int64()

	// Sliding window: weight previous window by remaining fraction
	elapsed := time.Since(time.Now().Truncate(cfg.Window))
	weight := 1.0 - (float64(elapsed) / float64(cfg.Window))
	if weight < 0 {
		weight = 0
	}
	total := int(float64(prevCount)*weight) + int(count)

	remaining = cfg.Limit - total
	if remaining < 0 {
		remaining = 0
	}

	return total <= cfg.Limit, remaining, nil
}

func extractIdentifier(r *http.Request) string {
	// Use X-Forwarded-For if behind a proxy
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
