package auth_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/orion-rigel/orion/pkg/auth"
)

func setupBlacklist(t *testing.T) (*auth.TokenBlacklist, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return auth.NewTokenBlacklist(rdb), mr
}

func TestTokenBlacklist_RevokeAndCheck(t *testing.T) {
	t.Parallel()
	bl, _ := setupBlacklist(t)
	ctx := context.Background()

	tests := []struct {
		name        string
		jti         string
		revoke      bool
		wantRevoked bool
	}{
		{
			name:        "revoked token is detected",
			jti:         "aaa-bbb-ccc",
			revoke:      true,
			wantRevoked: true,
		},
		{
			name:        "unknown token is not revoked",
			jti:         "xxx-yyy-zzz",
			revoke:      false,
			wantRevoked: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.revoke {
				if err := bl.Revoke(ctx, tc.jti, 10*time.Minute); err != nil {
					t.Fatalf("Revoke() error: %v", err)
				}
			}
			got := bl.IsRevoked(ctx, tc.jti)
			if got != tc.wantRevoked {
				t.Errorf("IsRevoked(%q) = %v, want %v", tc.jti, got, tc.wantRevoked)
			}
		})
	}
}

func TestTokenBlacklist_TTLExpiry(t *testing.T) {
	t.Parallel()
	bl, mr := setupBlacklist(t)
	ctx := context.Background()

	jti := "expiring-token"
	if err := bl.Revoke(ctx, jti, 1*time.Second); err != nil {
		t.Fatalf("Revoke() error: %v", err)
	}

	if !bl.IsRevoked(ctx, jti) {
		t.Fatal("expected token to be revoked immediately after Revoke()")
	}

	// Fast-forward past the TTL in miniredis.
	mr.FastForward(2 * time.Second)

	if bl.IsRevoked(ctx, jti) {
		t.Fatal("expected token revocation to expire after TTL")
	}
}
