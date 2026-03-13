// Package auth provides JWT token utilities including a Redis-backed
// token blacklist for revocation.
package auth

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

const blacklistKeyPrefix = "orion:token:blacklist:"

// TokenBlacklist stores revoked JWT IDs (JTIs) in Redis so that tokens
// can be invalidated before their natural expiry.
type TokenBlacklist struct {
	rdb *redis.Client
}

// NewTokenBlacklist creates a TokenBlacklist backed by the given Redis client.
func NewTokenBlacklist(rdb *redis.Client) *TokenBlacklist {
	return &TokenBlacklist{rdb: rdb}
}

// Revoke marks the given JTI as revoked. The key expires after the
// supplied duration so it does not outlive the token itself.
func (b *TokenBlacklist) Revoke(ctx context.Context, jti string, expiry time.Duration) error {
	key := blacklistKeyPrefix + jti
	if err := b.rdb.Set(ctx, key, "1", expiry).Err(); err != nil {
		return fmt.Errorf("revoking token %s: %w", jti, err)
	}
	slog.Info("token_revoked", "jti", jti)
	return nil
}

// IsRevoked returns true when the JTI has been previously revoked.
func (b *TokenBlacklist) IsRevoked(ctx context.Context, jti string) bool {
	key := blacklistKeyPrefix + jti
	n, err := b.rdb.Exists(ctx, key).Result()
	if err != nil {
		slog.Error("blacklist_check_failed", "jti", jti, "error", err)
		// Fail closed — treat as revoked when Redis is unreachable.
		return true
	}
	return n > 0
}
