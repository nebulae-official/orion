package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

// RateLimitConfig configures rate limiting for a route group.
type RateLimitConfig struct {
	Group          string
	Limit          int
	Window         time.Duration
	TrustedProxies []string
}

// rateLimitScript is a Lua script that atomically checks and increments
// a rate limit counter. It only increments when the request is allowed,
// preventing denied requests from inflating the counter.
var rateLimitScript = redis.NewScript(`
local key = KEYS[1]
local prev_key = KEYS[2]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local weight = tonumber(ARGV[3])

local current = tonumber(redis.call('GET', key) or '0')
local prev = tonumber(redis.call('GET', prev_key) or '0')

local total = math.floor(prev * weight) + current

if total >= limit then
    return {0, 0}
end

local new_count = redis.call('INCR', key)
if new_count == 1 then
    redis.call('EXPIRE', key, window * 2)
end

local new_total = math.floor(prev * weight) + new_count
local remaining = limit - new_total
if remaining < 0 then
    remaining = 0
end

return {1, remaining}
`)

// inMemoryLimiter provides a per-key in-memory fallback rate limiter
// with automatic eviction of stale entries.
type inMemoryLimiter struct {
	mu       sync.Mutex
	limiters map[string]*limiterEntry
	limit    rate.Limit
	burst    int
	maxSize  int
}

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newInMemoryLimiter(requestsPerWindow int, window time.Duration) *inMemoryLimiter {
	l := &inMemoryLimiter{
		limiters: make(map[string]*limiterEntry),
		limit:    rate.Limit(float64(requestsPerWindow) / window.Seconds()),
		burst:    requestsPerWindow,
		maxSize:  10000,
	}
	// Evict stale entries every minute.
	go l.evictLoop()
	return l
}

func (l *inMemoryLimiter) evictLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		l.mu.Lock()
		cutoff := time.Now().Add(-5 * time.Minute)
		for key, entry := range l.limiters {
			if entry.lastSeen.Before(cutoff) {
				delete(l.limiters, key)
			}
		}
		l.mu.Unlock()
	}
}

func (l *inMemoryLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, ok := l.limiters[key]
	if !ok {
		// Evict oldest if at capacity.
		if len(l.limiters) >= l.maxSize {
			var oldestKey string
			var oldestTime time.Time
			for k, e := range l.limiters {
				if oldestKey == "" || e.lastSeen.Before(oldestTime) {
					oldestKey = k
					oldestTime = e.lastSeen
				}
			}
			delete(l.limiters, oldestKey)
		}
		entry = &limiterEntry{
			limiter:  rate.NewLimiter(l.limit, l.burst),
			lastSeen: time.Now(),
		}
		l.limiters[key] = entry
	}
	entry.lastSeen = time.Now()
	return entry.limiter.Allow()
}

// RateLimit returns Chi-compatible middleware that enforces a sliding window
// rate limit using Redis. Requests exceeding the limit receive 429.
// When Redis is unavailable, it falls back to an in-memory rate limiter.
func RateLimit(rdb *redis.Client, cfg RateLimitConfig) func(http.Handler) http.Handler {
	fallback := newInMemoryLimiter(cfg.Limit, cfg.Window)
	trustedSet := buildTrustedSet(cfg.TrustedProxies)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			identifier := extractIdentifier(r, trustedSet)

			windowStart := time.Now().Truncate(cfg.Window)
			key := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Unix())
			prevKey := fmt.Sprintf("ratelimit:%s:%s:%d", cfg.Group, identifier, windowStart.Add(-cfg.Window).Unix())

			// Sliding window weight for previous window
			elapsed := time.Since(windowStart)
			weight := 1.0 - (float64(elapsed) / float64(cfg.Window))
			if weight < 0 {
				weight = 0
			}

			allowed, remaining, err := checkRateLimitAtomic(ctx, rdb, key, prevKey, cfg, weight)
			if err != nil {
				// Fall back to in-memory limiter when Redis is unavailable.
				slog.Warn("rate_limiter_redis_unavailable, using in-memory fallback",
					"group", cfg.Group,
					"error", err,
				)
				fallbackKey := fmt.Sprintf("%s:%s", cfg.Group, identifier)
				if !fallback.Allow(fallbackKey) {
					writeRateLimitResponse(w, cfg, windowStart, 0)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
			resetTime := windowStart.Add(cfg.Window)
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

			if !allowed {
				writeRateLimitResponse(w, cfg, windowStart, remaining)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func checkRateLimitAtomic(
	ctx context.Context,
	rdb *redis.Client,
	key, prevKey string,
	cfg RateLimitConfig,
	weight float64,
) (allowed bool, remaining int, err error) {
	result, err := rateLimitScript.Run(ctx, rdb, []string{key, prevKey},
		cfg.Limit,
		int(cfg.Window.Seconds()),
		weight,
	).Int64Slice()
	if err != nil {
		return false, 0, fmt.Errorf("rate limit lua script: %w", err)
	}

	if len(result) != 2 {
		return false, 0, fmt.Errorf("rate limit lua script: unexpected result length %d", len(result))
	}

	return result[0] == 1, int(result[1]), nil
}

func writeRateLimitResponse(w http.ResponseWriter, cfg RateLimitConfig, windowStart time.Time, remaining int) {
	resetTime := windowStart.Add(cfg.Window)
	retryAfter := int(time.Until(resetTime).Seconds()) + 1
	if retryAfter < 1 {
		retryAfter = 1
	}

	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.Limit))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))
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
	json.NewEncoder(w).Encode(errResp) //nolint:errcheck
}

// buildTrustedSet builds a set of trusted proxy IPs for quick lookup.
func buildTrustedSet(proxies []string) map[string]struct{} {
	set := make(map[string]struct{}, len(proxies))
	for _, p := range proxies {
		set[strings.TrimSpace(p)] = struct{}{}
	}
	return set
}

func extractIdentifier(r *http.Request, trustedProxies map[string]struct{}) string {
	remoteIP := remoteAddrIP(r.RemoteAddr)

	// Only trust X-Forwarded-For when RemoteAddr is a trusted proxy.
	if len(trustedProxies) > 0 {
		if _, trusted := trustedProxies[remoteIP]; trusted {
			if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
				// Take the rightmost untrusted IP.
				parts := strings.Split(xff, ",")
				for i := len(parts) - 1; i >= 0; i-- {
					ip := strings.TrimSpace(parts[i])
					if ip == "" {
						continue
					}
					if _, isTrusted := trustedProxies[ip]; !isTrusted {
						return ip
					}
				}
			}
		}
	}

	return remoteIP
}

func remoteAddrIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}
